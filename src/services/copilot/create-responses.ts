import consola from "consola"
import { events } from "fetch-event-stream"
import { randomUUID } from "node:crypto"

import { copilotBaseUrl, copilotHeaders } from "~/lib/api-config"
import { HTTPError } from "~/lib/error"
import { state } from "~/lib/state"

import type {
  ChatCompletionChunk,
  ChatCompletionResponse,
  ChatCompletionsPayload,
  ToolCall,
} from "./create-chat-completions"

// ── Request translation: OpenAI Chat Completions → Responses API ──

interface ResponsesPayload {
  model: string
  input: Array<ResponsesInput>
  max_output_tokens?: number
  tools?: Array<ResponsesTool>
  tool_choice?: string | { type: string; name?: string }
  stream?: boolean
  reasoning?: { effort: string }
}

type ResponsesInput =
  | {
      type: "message"
      role: "developer" | "user" | "assistant"
      content: string | Array<ResponsesContentPart>
    }
  | { type: "function_call"; name: string; arguments: string; call_id: string }
  | { type: "function_call_output"; call_id: string; output: string }

interface ResponsesContentPart {
  type: "input_text" | "input_image"
  text?: string
  image_url?: string
  detail?: string
}

interface ResponsesTool {
  type: "function"
  name: string
  description?: string
  parameters: Record<string, unknown>
}

function translateMessageContent(
  content:
    | string
    | Array<{
        type: string
        text?: string
        image_url?: { url: string; detail?: string }
      }>
    | undefined,
): string | Array<ResponsesContentPart> {
  if (typeof content === "string") return content
  if (!content) return ""
  return content.map((p) => {
    if (p.type === "text")
      return { type: "input_text" as const, text: p.text ?? "" }
    return {
      type: "input_image" as const,
      image_url: p.image_url?.url,
      detail: p.image_url?.detail,
    }
  })
}

function translateMessages(
  messages: ChatCompletionsPayload["messages"],
): Array<ResponsesInput> {
  const input: Array<ResponsesInput> = []

  for (const msg of messages) {
    switch (msg.role) {
      case "system":
      case "developer": {
        input.push({
          type: "message",
          role: "developer",
          content: translateMessageContent(msg.content ?? ""),
        })

        break
      }
      case "user": {
        input.push({
          type: "message",
          role: "user",
          content: translateMessageContent(msg.content ?? ""),
        })

        break
      }
      case "assistant": {
        // TODO: When Copilot starts populating reasoning summaries,
        // we should detect thinking blocks in msg.content and map them
        // to { type: "reasoning", summary: [{type: "summary_text", text}] }
        // instead of sending them as plain assistant text. Currently
        // thinking blocks are concatenated into content by translateToOpenAI,
        // which works functionally but loses semantic meaning for /responses.
        if (msg.content) {
          input.push({
            type: "message",
            role: "assistant",
            content: translateMessageContent(msg.content),
          })
        }
        if (msg.tool_calls) {
          for (const tc of msg.tool_calls) {
            input.push({
              type: "function_call",
              name: tc.function.name,
              arguments: tc.function.arguments,
              call_id: tc.id,
            })
          }
        }

        break
      }
      case "tool": {
        input.push({
          type: "function_call_output",
          call_id: msg.tool_call_id ?? "",
          output:
            typeof msg.content === "string" ?
              msg.content
            : JSON.stringify(msg.content),
        })

        break
      }
      // No default
    }
  }

  return input
}

function translateTools(
  payload: ChatCompletionsPayload,
): Partial<ResponsesPayload> {
  const result: Partial<ResponsesPayload> = {}

  if (payload.tools) {
    result.tools = payload.tools.map((t) => ({
      type: "function" as const,
      name: t.function.name,
      description: t.function.description,
      parameters: t.function.parameters,
    }))
  }

  if (payload.tool_choice) {
    result.tool_choice =
      typeof payload.tool_choice === "string" ?
        payload.tool_choice
      : { type: "function", name: payload.tool_choice.function.name }
  }

  return result
}

export function translateRequestToResponses(
  payload: ChatCompletionsPayload,
): ResponsesPayload {
  const result: ResponsesPayload = {
    model: payload.model,
    input: translateMessages(payload.messages),
    stream: payload.stream ?? undefined,
    ...translateTools(payload),
  }

  if (payload.max_tokens !== null && payload.max_tokens !== undefined)
    result.max_output_tokens = payload.max_tokens
  // Note: temperature and top_p are intentionally omitted — the /responses
  // API rejects them for GPT-5.x models ("Unsupported parameter").

  return result
}

// ── Response translation: Responses API → OpenAI Chat Completions ──

interface ResponsesResponse {
  id: string
  object: string
  created_at?: number
  model: string
  output: Array<ResponsesOutputItem>
  usage?: {
    input_tokens: number
    output_tokens: number
    total_tokens: number
  }
  status?: string
}

type ResponsesOutputItem =
  | {
      type: "message"
      role: "assistant"
      content: Array<ResponsesMessageContent>
    }
  | { type: "function_call"; name: string; arguments: string; call_id: string }
  | {
      type: "reasoning"
      id: string
      summary?: Array<{ type: "summary_text"; text: string }>
      encrypted_content?: string | null
    }

interface ResponsesMessageContent {
  type: "output_text"
  text: string
}

export function translateResponsesNonStreaming(
  resp: ResponsesResponse,
): ChatCompletionResponse {
  let textContent = ""
  let reasoningText = ""
  const toolCalls: Array<ToolCall> = []

  for (const item of resp.output) {
    switch (item.type) {
      case "message": {
        textContent += item.content.map((c) => c.text).join("")

        break
      }
      case "function_call": {
        toolCalls.push({
          id: item.call_id,
          type: "function",
          function: { name: item.name, arguments: item.arguments },
        })

        break
      }
      case "reasoning": {
        // Extract reasoning summary text if available
        if (item.summary && item.summary.length > 0) {
          reasoningText += item.summary.map((s) => s.text).join("\n")
        }

        break
      }
      // No default
    }
    // Skip other unknown item types
  }

  const finishReason = toolCalls.length > 0 ? "tool_calls" : "stop"

  return {
    id: resp.id,
    object: "chat.completion",
    created: resp.created_at ?? Math.floor(Date.now() / 1000),
    model: resp.model,
    choices: [
      {
        index: 0,
        message: {
          role: "assistant",
          content: textContent || null,
          ...(reasoningText ? { reasoning_text: reasoningText } : {}),
          ...(toolCalls.length > 0 ? { tool_calls: toolCalls } : {}),
        },
        logprobs: null,
        finish_reason: finishReason,
      },
    ],
    usage:
      resp.usage ?
        {
          prompt_tokens: resp.usage.input_tokens,
          completion_tokens: resp.usage.output_tokens,
          total_tokens: resp.usage.total_tokens,
        }
      : undefined,
  }
}

// ── Streaming translation: Responses API SSE → Chat Completions chunks ──

export interface ResponsesStreamState {
  responseId: string
  model: string
  toolCallIndex: number
  toolCallsByCallId: Partial<Record<string, ResponsesStreamToolCall>>
  toolCallsByOutputIndex: Partial<Record<number, ResponsesStreamToolCall>>
  fallbackId: string
  created: number
}

export function createResponsesStreamState(): ResponsesStreamState {
  return {
    responseId: "",
    model: "",
    toolCallIndex: 0,
    toolCallsByCallId: {},
    toolCallsByOutputIndex: {},
    fallbackId: `chatcmpl-${randomUUID()}`,
    created: Math.floor(Date.now() / 1000),
  }
}

interface ResponsesStreamToolCall {
  arguments: string
  callId: string
  index: number
  name: string
}

interface ResponsesStreamUsage {
  input_tokens: number
  output_tokens: number
  total_tokens: number
  input_tokens_details?: {
    cached_tokens: number
  }
}

interface ResponsesStreamResponse {
  id?: string
  model?: string
  usage?: ResponsesStreamUsage
  error?: {
    type?: string
    message?: string
  }
  incomplete_details?: {
    reason?: string
  }
}

interface ResponsesStreamItem {
  arguments?: string
  call_id?: string
  id?: string
  name?: string
  type?: string
}

interface ResponsesStreamEventData {
  arguments?: string
  call_id?: string
  code?: string
  delta?: string
  id?: string
  item?: ResponsesStreamItem
  message?: string
  model?: string
  name?: string
  output_index?: number
  response?: ResponsesStreamResponse
}

function makeChunk(
  streamState: ResponsesStreamState,
  {
    delta,
    finishReason,
    usage,
  }: {
    delta: Record<string, unknown>
    finishReason: string | null
    usage?: ChatCompletionChunk["usage"]
  },
): ChatCompletionChunk {
  return {
    id: streamState.responseId || streamState.fallbackId,
    object: "chat.completion.chunk",
    created: streamState.created,
    model: streamState.model,
    usage,
    choices: [
      {
        index: 0,
        delta: delta as ChatCompletionChunk["choices"][0]["delta"],
        finish_reason:
          finishReason as ChatCompletionChunk["choices"][0]["finish_reason"],
        logprobs: null,
      },
    ],
  }
}

function syncResponseMetadata(
  streamState: ResponsesStreamState,
  data: ResponsesStreamEventData,
) {
  if (!streamState.responseId) {
    streamState.responseId = data.response?.id ?? data.id ?? ""
  }
  if (!streamState.model) {
    streamState.model = data.response?.model ?? data.model ?? ""
  }
}

function translateResponsesUsage(
  usage: ResponsesStreamUsage | undefined,
): ChatCompletionChunk["usage"] | undefined {
  if (!usage) {
    return undefined
  }

  return {
    prompt_tokens: usage.input_tokens,
    completion_tokens: usage.output_tokens,
    total_tokens: usage.total_tokens,
    ...(usage.input_tokens_details && {
      prompt_tokens_details: {
        cached_tokens: usage.input_tokens_details.cached_tokens,
      },
    }),
  }
}

function getToolCallDelta(
  toolCall: ResponsesStreamToolCall,
  argumentsChunk: string,
): ChatCompletionChunk["choices"][0]["delta"] {
  return {
    tool_calls: [
      {
        index: toolCall.index,
        function: { arguments: argumentsChunk },
      },
    ],
  }
}

function getNewToolCallDelta(
  toolCall: ResponsesStreamToolCall,
  argumentsChunk: string,
): ChatCompletionChunk["choices"][0]["delta"] {
  return {
    tool_calls: [
      {
        index: toolCall.index,
        id: toolCall.callId,
        type: "function",
        function: {
          name: toolCall.name,
          arguments: argumentsChunk,
        },
      },
    ],
  }
}

function getExistingToolCall(
  streamState: ResponsesStreamState,
  data: Pick<ResponsesStreamEventData, "call_id" | "output_index">,
): ResponsesStreamToolCall | undefined {
  if (data.output_index !== undefined) {
    const outputIndexToolCall =
      streamState.toolCallsByOutputIndex[data.output_index]
    if (outputIndexToolCall) {
      return outputIndexToolCall
    }
  }

  return data.call_id ? streamState.toolCallsByCallId[data.call_id] : undefined
}

function getOrCreateToolCall(
  streamState: ResponsesStreamState,
  {
    callId,
    initialArguments = "",
    name,
    outputIndex,
  }: {
    callId?: string
    initialArguments?: string
    name?: string
    outputIndex?: number
  },
): { isNew: boolean; toolCall: ResponsesStreamToolCall } | undefined {
  if (!callId || !name) {
    return undefined
  }

  const existingToolCall =
    streamState.toolCallsByCallId[callId]
    ?? (outputIndex !== undefined ?
      streamState.toolCallsByOutputIndex[outputIndex]
    : undefined)

  if (existingToolCall) {
    streamState.toolCallsByCallId[callId] = existingToolCall
    if (outputIndex !== undefined) {
      streamState.toolCallsByOutputIndex[outputIndex] = existingToolCall
    }

    return { isNew: false, toolCall: existingToolCall }
  }

  const toolCall: ResponsesStreamToolCall = {
    arguments: initialArguments,
    callId,
    index: streamState.toolCallIndex,
    name,
  }

  streamState.toolCallsByCallId[callId] = toolCall
  if (outputIndex !== undefined) {
    streamState.toolCallsByOutputIndex[outputIndex] = toolCall
  }
  streamState.toolCallIndex++

  return { isNew: true, toolCall }
}

function* syncToolArguments(
  streamState: ResponsesStreamState,
  toolCall: ResponsesStreamToolCall,
  nextArguments: string | undefined,
): Generator<ChatCompletionChunk> {
  if (!nextArguments || nextArguments === toolCall.arguments) {
    return
  }

  if (!nextArguments.startsWith(toolCall.arguments)) {
    consola.warn(
      "Tool call argument stream diverged; preserving streamed prefix",
      {
        callId: toolCall.callId,
        name: toolCall.name,
        accumulatedLength: toolCall.arguments.length,
        candidateLength: nextArguments.length,
        accumulatedTail: toolCall.arguments.slice(-80),
        candidateHead: nextArguments.slice(0, 80),
      },
    )
    return
  }

  const missingArguments = nextArguments.slice(toolCall.arguments.length)
  toolCall.arguments = nextArguments

  if (!missingArguments) {
    return
  }

  yield makeChunk(streamState, {
    delta: getToolCallDelta(toolCall, missingArguments),
    finishReason: null,
  })
}

function* handleCreatedEvent(
  streamState: ResponsesStreamState,
  data: ResponsesStreamEventData,
): Generator<ChatCompletionChunk> {
  syncResponseMetadata(streamState, data)
  yield makeChunk(streamState, {
    delta: { role: "assistant", content: "" },
    finishReason: null,
  })
}

function* handleOutputTextDeltaEvent(
  streamState: ResponsesStreamState,
  data: ResponsesStreamEventData,
): Generator<ChatCompletionChunk> {
  if (!data.delta) {
    return
  }

  yield makeChunk(streamState, {
    delta: { content: data.delta },
    finishReason: null,
  })
}

function* handleOutputItemAddedEvent(
  streamState: ResponsesStreamState,
  data: ResponsesStreamEventData,
): Generator<ChatCompletionChunk> {
  if (data.item?.type !== "function_call") {
    return
  }

  const toolCall = getOrCreateToolCall(streamState, {
    callId: data.item.call_id,
    initialArguments: data.item.arguments ?? "",
    name: data.item.name,
    outputIndex: data.output_index,
  })

  if (!toolCall?.isNew) {
    return
  }

  yield makeChunk(streamState, {
    delta: getNewToolCallDelta(toolCall.toolCall, data.item.arguments ?? ""),
    finishReason: null,
  })
}

function* handleFunctionCallArgumentsDeltaEvent(
  streamState: ResponsesStreamState,
  data: ResponsesStreamEventData,
): Generator<ChatCompletionChunk> {
  if (!data.delta) {
    return
  }

  const existingToolCall = getExistingToolCall(streamState, data)
  if (existingToolCall) {
    existingToolCall.arguments += data.delta
    yield makeChunk(streamState, {
      delta: getToolCallDelta(existingToolCall, data.delta),
      finishReason: null,
    })
    return
  }

  const toolCall = getOrCreateToolCall(streamState, {
    callId: data.call_id,
    initialArguments: data.delta,
    name: data.name,
    outputIndex: data.output_index,
  })

  if (!toolCall) {
    return
  }

  yield makeChunk(streamState, {
    delta: getNewToolCallDelta(toolCall.toolCall, data.delta),
    finishReason: null,
  })
}

function* handleFunctionCallArgumentsDoneEvent(
  streamState: ResponsesStreamState,
  data: ResponsesStreamEventData,
): Generator<ChatCompletionChunk> {
  const existingToolCall = getExistingToolCall(streamState, data)
  if (!existingToolCall) {
    return
  }

  yield* syncToolArguments(streamState, existingToolCall, data.arguments)
}

function getExistingOrCreateCompletedToolCall(
  streamState: ResponsesStreamState,
  data: ResponsesStreamEventData,
): { isNew: boolean; toolCall: ResponsesStreamToolCall } | undefined {
  const existingToolCall = getExistingToolCall(streamState, {
    call_id: data.item?.call_id,
    output_index: data.output_index,
  })

  if (existingToolCall) {
    return { isNew: false, toolCall: existingToolCall }
  }

  return getOrCreateToolCall(streamState, {
    callId: data.item?.call_id,
    initialArguments: data.item?.arguments ?? "",
    name: data.item?.name,
    outputIndex: data.output_index,
  })
}

function* handleOutputItemDoneEvent(
  streamState: ResponsesStreamState,
  data: ResponsesStreamEventData,
): Generator<ChatCompletionChunk> {
  if (data.item?.type !== "function_call") {
    return
  }

  const toolCall = getExistingOrCreateCompletedToolCall(streamState, data)
  if (!toolCall) {
    return
  }

  if (toolCall.isNew) {
    yield makeChunk(streamState, {
      delta: getNewToolCallDelta(toolCall.toolCall, data.item.arguments ?? ""),
      finishReason: null,
    })
  }

  yield* syncToolArguments(streamState, toolCall.toolCall, data.item.arguments)
}

function* handleCompletedEvent(
  streamState: ResponsesStreamState,
  data: ResponsesStreamEventData,
): Generator<ChatCompletionChunk> {
  syncResponseMetadata(streamState, data)
  const hasToolCalls = Object.keys(streamState.toolCallsByCallId).length > 0

  yield makeChunk(streamState, {
    delta: {},
    finishReason: hasToolCalls ? "tool_calls" : "stop",
    usage: translateResponsesUsage(data.response?.usage),
  })
}

function mapIncompleteReasonToFinishReason(
  reason: string | undefined,
): "stop" | "length" | "content_filter" {
  switch (reason) {
    case "max_output_tokens": {
      return "length"
    }
    case "content_filter": {
      return "content_filter"
    }
    default: {
      return "stop"
    }
  }
}

function* handleFailedEvent(
  streamState: ResponsesStreamState,
  data: ResponsesStreamEventData,
): Generator<ChatCompletionChunk> {
  syncResponseMetadata(streamState, data)
  const errorType = data.response?.error?.type ?? "api_error"
  const message = data.response?.error?.message ?? "Upstream response failed"
  consola.warn("Upstream /responses failed", { type: errorType, message })

  const chunk = makeChunk(streamState, {
    delta: {},
    finishReason: null,
    usage: translateResponsesUsage(data.response?.usage),
  })
  chunk.error = { type: errorType, message }
  yield chunk
}

function* handleErrorEvent(
  streamState: ResponsesStreamState,
  data: ResponsesStreamEventData,
): Generator<ChatCompletionChunk> {
  const errorType = data.code ?? "api_error"
  const message = data.message ?? "Upstream error"
  consola.warn("Upstream /responses error event", {
    type: errorType,
    message,
  })

  const chunk = makeChunk(streamState, {
    delta: {},
    finishReason: null,
  })
  chunk.error = { type: errorType, message, code: data.code }
  yield chunk
}

function* handleIncompleteEvent(
  streamState: ResponsesStreamState,
  data: ResponsesStreamEventData,
): Generator<ChatCompletionChunk> {
  syncResponseMetadata(streamState, data)
  const finishReason = mapIncompleteReasonToFinishReason(
    data.response?.incomplete_details?.reason,
  )

  yield makeChunk(streamState, {
    delta: {},
    finishReason,
    usage: translateResponsesUsage(data.response?.usage),
  })
}

export function* translateResponsesStreamEvent(
  event: {
    event: string
    data: ResponsesStreamEventData
  },
  streamState: ResponsesStreamState,
): Generator<ChatCompletionChunk> {
  const { event: eventType, data } = event

  switch (eventType) {
    case "response.created": {
      yield* handleCreatedEvent(streamState, data)
      break
    }

    case "response.in_progress": {
      syncResponseMetadata(streamState, data)
      break
    }

    case "response.output_text.delta": {
      yield* handleOutputTextDeltaEvent(streamState, data)
      break
    }

    case "response.output_item.added": {
      yield* handleOutputItemAddedEvent(streamState, data)
      break
    }

    case "response.function_call_arguments.delta": {
      yield* handleFunctionCallArgumentsDeltaEvent(streamState, data)
      break
    }

    case "response.function_call_arguments.done": {
      yield* handleFunctionCallArgumentsDoneEvent(streamState, data)
      break
    }

    case "response.output_item.done": {
      yield* handleOutputItemDoneEvent(streamState, data)
      break
    }

    case "response.completed": {
      yield* handleCompletedEvent(streamState, data)
      break
    }

    case "response.failed": {
      yield* handleFailedEvent(streamState, data)
      break
    }

    case "response.incomplete": {
      yield* handleIncompleteEvent(streamState, data)
      break
    }

    case "error": {
      yield* handleErrorEvent(streamState, data)
      break
    }

    default: {
      break
    }
  }
}

// ── Service function: call the upstream /responses endpoint ──

export async function createResponses(payload: ChatCompletionsPayload) {
  if (!state.copilotToken) throw new Error("Copilot token not found")

  const responsesPayload = translateRequestToResponses(payload)

  const url = `${copilotBaseUrl(state)}/responses`
  consola.debug(`Sending /responses request for model: ${payload.model}`)

  const response = await fetch(url, {
    method: "POST",
    headers: copilotHeaders(state),
    body: JSON.stringify(responsesPayload),
  })

  if (!response.ok) {
    consola.error("Failed to create responses", response)
    throw new HTTPError("Failed to create responses", response)
  }

  if (payload.stream) {
    return events(response)
  }

  const rawResponse = (await response.json()) as ResponsesResponse
  return translateResponsesNonStreaming(rawResponse)
}
