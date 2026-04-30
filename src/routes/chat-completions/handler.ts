import type { Context } from "hono"

import consola from "consola"
import { streamSSE, type SSEMessage } from "hono/streaming"

import { awaitApproval } from "~/lib/approval"
import { resolveEndpoint } from "~/lib/endpoint-routing"
import { checkRateLimit } from "~/lib/rate-limit"
import { state } from "~/lib/state"
import { getTokenCount } from "~/lib/tokenizer"
import { isNullish } from "~/lib/utils"
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
