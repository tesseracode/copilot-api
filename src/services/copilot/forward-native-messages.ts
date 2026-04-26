import consola from "consola"
import { events } from "fetch-event-stream"

import type { AnthropicMessagesPayload } from "~/routes/messages/anthropic-types"

import { copilotBaseUrl, copilotHeaders } from "~/lib/api-config"
import { HTTPError } from "~/lib/error"
import { anthropicToCopilotModelId } from "~/lib/model-mapping"
import { state } from "~/lib/state"

/**
 * Downgrade thinking.type from 'adaptive' to 'enabled',
 * since the Copilot /v1/messages endpoint doesn't support adaptive yet.
 */
function normalizeThinking(
  body: Record<string, unknown>,
): Record<string, unknown> {
  const thinking = body.thinking as
    | { type: string; budget_tokens?: number }
    | undefined
  if (thinking?.type === "adaptive") {
    const maxTokens =
      typeof body.max_tokens === "number" ? body.max_tokens : 16384
    body.thinking = {
      type: "enabled",
      budget_tokens: Math.max(1024, maxTokens - 1),
    }
  }
  return body
}

/**
 * Forward a /v1/messages request directly to the upstream Copilot API's
 * native Anthropic /v1/messages endpoint, with minimal transformation.
 */
export async function forwardNativeMessages(
  payload: AnthropicMessagesPayload,
): Promise<Response> {
  const copilotModelId = anthropicToCopilotModelId(
    payload.model,
    state.is1MContext,
  )

  const body = normalizeThinking({
    ...payload,
    model: copilotModelId,
  })

  const url = `${copilotBaseUrl(state)}/v1/messages`

  consola.debug(
    `Native passthrough: ${payload.model} -> ${copilotModelId} via ${url}`,
  )

  const response = await fetch(url, {
    method: "POST",
    headers: copilotHeaders(state),
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    throw new HTTPError(
      `Native /v1/messages request failed for model ${copilotModelId}`,
      response,
    )
  }

  return response
}

/**
 * Forward a native /v1/messages request and return the parsed JSON response.
 */
export async function forwardNativeMessagesNonStreaming(
  payload: AnthropicMessagesPayload,
) {
  const response = await forwardNativeMessages({
    ...payload,
    stream: false,
  })
  return await response.json()
}

/**
 * Forward a native /v1/messages request in streaming mode and yield SSE events.
 */
export async function* forwardNativeMessagesStreaming(
  payload: AnthropicMessagesPayload,
) {
  const response = await forwardNativeMessages({
    ...payload,
    stream: true,
  })

  const stream = events(response)
  for await (const event of stream) {
    if (!event.data || event.data === "[DONE]") continue
    try {
      const data = JSON.parse(event.data) as Record<string, unknown>
      yield { type: (event.event ?? data.type) as string, data }
    } catch {
      consola.warn("Failed to parse native stream event:", event.data)
    }
  }
}
