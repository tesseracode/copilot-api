import type { Context } from "hono"

import consola from "consola"
import { streamSSE } from "hono/streaming"

import { awaitApproval } from "~/lib/approval"
import { resolveEndpoint } from "~/lib/endpoint-routing"
import { anthropicToCopilotModelId } from "~/lib/model-mapping"
import { checkRateLimit } from "~/lib/rate-limit"
import { state } from "~/lib/state"
import {
  createChatCompletions,
  type ChatCompletionChunk,
  type ChatCompletionResponse,
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

import {
  type AnthropicMessagesPayload,
  type AnthropicStreamState,
} from "./anthropic-types"
import {
  translateToAnthropic,
  translateToOpenAI,
} from "./non-stream-translation"
import { translateChunkToAnthropicEvents } from "./stream-translation"

const CONTEXT_1M_BETA = "context-1m-2025-08-07"

/**
 * Check if the request wants 1M context via the anthropic-beta header.
 * The Claude Agent SDK sets `anthropic-beta: context-1m-2025-08-07`
 * instead of appending [1m] to the model name.
 */
function detectWants1M(c: Context): boolean {
  const betaHeader = c.req.header("anthropic-beta") ?? ""
  return betaHeader.split(",").some((s) => s.trim() === CONTEXT_1M_BETA)
}

export async function handleCompletion(c: Context) {
  await checkRateLimit(state)

  const anthropicPayload = await c.req.json<AnthropicMessagesPayload>()
  consola.debug("Anthropic request payload:", JSON.stringify(anthropicPayload))

  if (state.manualApprove) {
    await awaitApproval()
  }

  // Check per-request 1M context: anthropic-beta header or global flag
  const wants1M = detectWants1M(c) || state.is1MContext

  const copilotModelId = anthropicToCopilotModelId(
    anthropicPayload.model,
    wants1M,
  )
  const endpoint = resolveEndpoint(copilotModelId, state.models)

  // Native Anthropic passthrough for Claude models
  if (endpoint === "/v1/messages") {
    consola.debug(`Using native /v1/messages passthrough for ${copilotModelId}`)
    return handleNativePassthrough(c, anthropicPayload, wants1M)
  }

  // Translate Anthropic → OpenAI format for non-Claude models
  const openAIPayload = translateToOpenAI(anthropicPayload)
  consola.debug(
    "Translated OpenAI request payload:",
    JSON.stringify(openAIPayload),
  )

  // /responses for GPT-5.x models (responses-only or preferred)
  if (endpoint === "/responses") {
    consola.debug(`Using /responses endpoint for ${copilotModelId}`)
    return handleResponsesViaAnthropic(c, openAIPayload)
  }

  // /chat/completions for legacy models
  const response = await createChatCompletions(openAIPayload)

  if (isNonStreaming(response)) {
    consola.debug(
      "Non-streaming response from Copilot:",
      JSON.stringify(response).slice(-400),
    )
    const anthropicResponse = translateToAnthropic(response)
    consola.debug(
      "Translated Anthropic response:",
      JSON.stringify(anthropicResponse),
    )
    return c.json(anthropicResponse)
  }

  consola.debug("Streaming response from Copilot")
  return streamSSE(c, async (stream) => {
    const streamState: AnthropicStreamState = {
      messageStartSent: false,
      contentBlockIndex: 0,
      contentBlockOpen: false,
      toolCalls: {},
    }

    for await (const rawEvent of response) {
      consola.debug("Copilot raw stream event:", JSON.stringify(rawEvent))
      if (rawEvent.data === "[DONE]") {
        break
      }

      if (!rawEvent.data) {
        continue
      }

      const chunk = JSON.parse(rawEvent.data) as ChatCompletionChunk
      const events = translateChunkToAnthropicEvents(chunk, streamState)

      for (const event of events) {
        consola.debug("Translated Anthropic event:", JSON.stringify(event))
        await stream.writeSSE({
          event: event.type,
          data: JSON.stringify(event),
        })
      }
    }
  })
}

async function handleNativePassthrough(
  c: Context,
  payload: AnthropicMessagesPayload,
  is1M: boolean,
) {
  if (!payload.stream) {
    const response = await forwardNativeMessagesNonStreaming(payload, is1M)
    return c.json(response)
  }

  return streamSSE(c, async (stream) => {
    for await (const event of forwardNativeMessagesStreaming(payload, is1M)) {
      await stream.writeSSE({
        event: event.type,
        data: JSON.stringify(event.data),
      })
    }
  })
}

const isNonStreaming = (
  response: Awaited<ReturnType<typeof createChatCompletions>>,
): response is ChatCompletionResponse => Object.hasOwn(response, "choices")

/**
 * Handle a request that needs the /responses endpoint but arrived via /v1/messages.
 * Flow: Anthropic payload → already translated to OpenAI → /responses → OpenAI response → Anthropic format.
 */
async function handleResponsesViaAnthropic(
  c: Context,
  openAIPayload: Parameters<typeof createResponses>[0],
) {
  const response = await createResponses(openAIPayload)

  if (isNonStreaming(response)) {
    const anthropicResponse = translateToAnthropic(response)
    return c.json(anthropicResponse)
  }

  return streamSSE(c, async (stream) => {
    const responsesState = createResponsesStreamState()
    const anthropicState: AnthropicStreamState = {
      messageStartSent: false,
      contentBlockIndex: 0,
      contentBlockOpen: false,
      toolCalls: {},
    }

    for await (const rawEvent of response) {
      if (!rawEvent.data || rawEvent.data === "[DONE]") continue

      const parsed = JSON.parse(rawEvent.data) as Record<string, unknown>
      const eventType =
        rawEvent.event ?? (parsed.type as string | undefined) ?? ""

      // Responses SSE → OpenAI chunks
      const chunks = translateResponsesStreamEvent(
        { event: eventType, data: parsed },
        responsesState,
      )

      // OpenAI chunks → Anthropic SSE events
      for (const chunk of chunks) {
        const events = translateChunkToAnthropicEvents(chunk, anthropicState)
        for (const event of events) {
          await stream.writeSSE({
            event: event.type,
            data: JSON.stringify(event),
          })
        }
      }
    }
  })
}
