import type { Context } from "hono"

import consola from "consola"
import { streamSSE, type SSEMessage } from "hono/streaming"

import { awaitApproval } from "~/lib/approval"
import { resolveEndpoint } from "~/lib/endpoint-routing"
import { checkRateLimit } from "~/lib/rate-limit"
import { state } from "~/lib/state"
import { getTokenCount } from "~/lib/tokenizer"
import { isNullish } from "~/lib/utils"
import { openaiToAnthropicPayload } from "~/routes/messages/non-stream-translation"
import {
  createChatCompletions,
  type ChatCompletionResponse,
  type ChatCompletionsPayload,
} from "~/services/copilot/create-chat-completions"
import {
  createResponses,
  createResponsesStreamState,
  translateResponsesStreamEvent,
} from "~/services/copilot/create-responses"
import {
  forwardNativeMessagesNonStreaming,
  forwardNativeMessagesStreaming,
} from "~/services/copilot/forward-native-messages"

export async function handleCompletion(c: Context) {
  await checkRateLimit(state)

  let payload = await c.req.json<ChatCompletionsPayload>()
  consola.debug("Request payload:", JSON.stringify(payload).slice(-400))

  // Find the selected model
  const selectedModel = state.models?.data.find(
    (model) => model.id === payload.model,
  )

  // Calculate and display token count
  try {
    if (selectedModel) {
      const tokenCount = await getTokenCount(payload, selectedModel)
      consola.info("Current token count:", tokenCount)
    } else {
      consola.warn("No model selected, skipping token count calculation")
    }
  } catch (error) {
    consola.warn("Failed to calculate token count:", error)
  }

  if (state.manualApprove) await awaitApproval()

  if (isNullish(payload.max_tokens)) {
    payload = {
      ...payload,
      max_tokens: selectedModel?.capabilities.limits.max_output_tokens,
    }
    consola.debug("Set max_tokens to:", JSON.stringify(payload.max_tokens))
  }

  const endpoint = resolveEndpoint(payload.model, state.models)
  const signal = c.req.raw.signal

  // Reroute Claude models to native /v1/messages passthrough
  // Claude on /chat/completions loses tool calling and other native features
  if (endpoint === "/v1/messages") {
    consola.debug(
      `Rerouting Claude model ${payload.model} to native /v1/messages`,
    )
    return handleNativeReroute(c, payload)
  }

  // Route to /responses for GPT-5.x and models that only support it
  if (endpoint === "/responses") {
    consola.debug(`Using /responses endpoint for model: ${payload.model}`)
    return handleResponsesEndpoint(c, payload, signal)
  }

  // Existing /chat/completions path
  const response = await createChatCompletions(payload, signal)

  if (isNonStreaming(response)) {
    consola.debug("Non-streaming response:", JSON.stringify(response))
    return c.json(response)
  }

  consola.debug("Streaming response")
  return streamSSE(c, async (stream) => {
    try {
      for await (const chunk of response) {
        consola.debug("Streaming chunk:", JSON.stringify(chunk))
        await stream.writeSSE(chunk as SSEMessage)
      }
    } catch (err) {
      if (
        signal.aborted
        || (err instanceof Error && err.name === "AbortError")
      ) {
        consola.debug("chat-completions stream aborted by client")
        return
      }
      throw err
    }
  })
}

async function handleResponsesEndpoint(
  c: Context,
  payload: ChatCompletionsPayload,
  signal?: AbortSignal,
) {
  const response = await createResponses(payload, signal)

  if (isNonStreaming(response)) {
    consola.debug("Non-streaming /responses result:", JSON.stringify(response))
    return c.json(response)
  }

  consola.debug("Streaming /responses response")
  return streamSSE(c, async (stream) => {
    const streamState = createResponsesStreamState()

    try {
      for await (const rawEvent of response) {
        if (!rawEvent.data || rawEvent.data === "[DONE]") continue

        const parsed = JSON.parse(rawEvent.data) as Record<string, unknown>
        const eventType =
          rawEvent.event ?? (parsed.type as string | undefined) ?? ""

        const chunks = translateResponsesStreamEvent(
          { event: eventType, data: parsed },
          streamState,
        )

        for (const chunk of chunks) {
          consola.debug("Translated /responses chunk:", JSON.stringify(chunk))
          await stream.writeSSE({
            data: JSON.stringify(chunk),
          })
        }
      }
    } catch (err) {
      if (
        signal?.aborted
        || (err instanceof Error && err.name === "AbortError")
      ) {
        consola.debug("/responses stream aborted by client")
        return
      }
      throw err
    }
  })
}

const isNonStreaming = (
  response: Awaited<ReturnType<typeof createChatCompletions>>,
): response is ChatCompletionResponse => Object.hasOwn(response, "choices")

/**
 * Reroute a /chat/completions request for a Claude model through
 * native /v1/messages passthrough. Translates OpenAI→Anthropic,
 * forwards natively, translates Anthropic→OpenAI back.
 */
async function handleNativeReroute(
  c: Context,
  payload: ChatCompletionsPayload,
) {
  const anthropicPayload = openaiToAnthropicPayload(payload)

  if (!payload.stream) {
    const response = await forwardNativeMessagesNonStreaming(anthropicPayload)
    return c.json(
      anthropicResponseToOpenAI(response as Record<string, unknown>),
    )
  }

  return streamSSE(c, async (stream) => {
    for await (const event of forwardNativeMessagesStreaming(
      anthropicPayload,
    )) {
      // Translate Anthropic SSE events to OpenAI chunks
      const chunk = anthropicEventToOpenAIChunk(event)
      if (chunk) {
        await stream.writeSSE({
          data: JSON.stringify(chunk),
        })
      }
    }
  })
}

/**
 * Convert Anthropic stop_reason to OpenAI finish_reason.
 */
function mapAnthropicFinishReason(
  stopReason: string | null | undefined,
): "stop" | "length" | "tool_calls" | "content_filter" {
  if (stopReason === "tool_use") return "tool_calls"
  if (stopReason === "max_tokens") return "length"
  return "stop"
}

/**
 * Extract text and tool calls from Anthropic content blocks.
 */
function extractAnthropicContent(
  content: Array<{
    type: string
    text?: string
    id?: string
    name?: string
    input?: unknown
  }>,
): {
  text: string
  toolCalls: Array<{
    id: string
    type: "function"
    function: { name: string; arguments: string }
  }>
} {
  let text = ""
  const toolCalls: Array<{
    id: string
    type: "function"
    function: { name: string; arguments: string }
  }> = []

  for (const block of content) {
    if (block.type === "text" && block.text) {
      text += block.text
    } else if (block.type === "tool_use" && block.name && block.id) {
      toolCalls.push({
        id: block.id,
        type: "function",
        function: {
          name: block.name,
          arguments: JSON.stringify(block.input ?? {}),
        },
      })
    }
  }

  return { text, toolCalls }
}

/**
 * Convert a raw Anthropic Messages response to OpenAI Chat Completion format.
 */
function anthropicResponseToOpenAI(
  resp: Record<string, unknown>,
): ChatCompletionResponse {
  const rawContent = resp.content as
    | Array<{
        type: string
        text?: string
        id?: string
        name?: string
        input?: unknown
      }>
    | undefined
  const content = rawContent ?? []
  const { text, toolCalls } = extractAnthropicContent(content)
  const finishReason = mapAnthropicFinishReason(
    resp.stop_reason as string | null,
  )
  const rawUsage = resp.usage as
    | { input_tokens: number; output_tokens: number }
    | undefined
  const usage =
    rawUsage ?
      {
        prompt_tokens: rawUsage.input_tokens,
        completion_tokens: rawUsage.output_tokens,
        total_tokens: rawUsage.input_tokens + rawUsage.output_tokens,
      }
    : undefined

  return {
    id: typeof resp.id === "string" ? resp.id : "",
    object: "chat.completion",
    created: Math.floor(Date.now() / 1000),
    model: typeof resp.model === "string" ? resp.model : "",
    choices: [
      {
        index: 0,
        message: {
          role: "assistant",
          content: text || null,
          ...(toolCalls.length > 0 ? { tool_calls: toolCalls } : {}),
        },
        logprobs: null,
        finish_reason: finishReason,
      },
    ],
    usage,
  }
}

/**
 * Convert an Anthropic SSE event to an OpenAI streaming chunk.
 */
function anthropicEventToOpenAIChunk(event: {
  type: string
  data: Record<string, unknown>
}): Record<string, unknown> | null {
  const { type, data } = event

  if (type === "content_block_delta") {
    const delta = data.delta as { type: string; text?: string } | undefined
    if (delta?.type === "text_delta" && delta.text) {
      return {
        object: "chat.completion.chunk",
        choices: [
          { index: 0, delta: { content: delta.text }, finish_reason: null },
        ],
      }
    }
  }

  if (type === "message_delta") {
    const delta = data.delta as Record<string, unknown> | undefined
    const stopReason = delta?.stop_reason as string | undefined
    if (stopReason) {
      return {
        object: "chat.completion.chunk",
        choices: [
          {
            index: 0,
            delta: {},
            finish_reason: mapAnthropicFinishReason(stopReason),
          },
        ],
      }
    }
  }

  return null
}
