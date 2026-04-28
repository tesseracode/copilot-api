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
  activeToolCalls: Record<string, boolean>
}

export function createResponsesStreamState(): ResponsesStreamState {
  return {
    responseId: "",
    model: "",
    toolCallIndex: 0,
    activeToolCalls: {},
  }
}

function makeChunk(
  streamState: ResponsesStreamState,
  delta: Record<string, unknown>,
  finishReason: string | null,
): ChatCompletionChunk {
  return {
    id: streamState.responseId || `chatcmpl-${randomUUID()}`,
    object: "chat.completion.chunk",
    created: Math.floor(Date.now() / 1000),
    model: streamState.model,
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

export function* translateResponsesStreamEvent(
  event: {
    event: string
    data: {
      delta?: string
      call_id?: string
      name?: string
      id?: string
      model?: string
    }
  },
  streamState: ResponsesStreamState,
): Generator<ChatCompletionChunk> {
  const { event: eventType, data } = event

  switch (eventType) {
    case "response.created": {
      streamState.responseId = data.id ?? ""
      streamState.model = data.model ?? ""
      yield makeChunk(streamState, { role: "assistant", content: "" }, null)
      break
    }

    case "response.output_text.delta": {
      if (data.delta) {
        yield makeChunk(streamState, { content: data.delta }, null)
      }
      break
    }

    case "response.function_call_arguments.delta": {
      const toolIndex = streamState.toolCallIndex
      const callId = data.call_id ?? ""

      if (!streamState.activeToolCalls[callId]) {
        streamState.activeToolCalls[callId] = true
        yield makeChunk(
          streamState,
          {
            tool_calls: [
              {
                index: toolIndex,
                id: callId,
                type: "function",
                function: { name: data.name, arguments: data.delta ?? "" },
              },
            ],
          },
          null,
        )
        streamState.toolCallIndex++
      } else {
        yield makeChunk(
          streamState,
          {
            tool_calls: [
              {
                index: toolIndex,
                function: { arguments: data.delta ?? "" },
              },
            ],
          },
          null,
        )
      }
      break
    }

    case "response.completed": {
      const hasToolCalls = Object.keys(streamState.activeToolCalls).length > 0
      yield makeChunk(streamState, {}, hasToolCalls ? "tool_calls" : "stop")
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
