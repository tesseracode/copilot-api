import consola from "consola"
import { events } from "fetch-event-stream"

import type { AnthropicMessagesPayload } from "~/routes/messages/anthropic-types"

import { copilotBaseUrl, copilotHeaders } from "~/lib/api-config"
import { HTTPError } from "~/lib/error"
import { anthropicToCopilotModelId } from "~/lib/model-mapping"
import { state } from "~/lib/state"

/**
 * Normalize thinking config for the Copilot /v1/messages endpoint.
 * Downgrades 'adaptive' to 'enabled' since Copilot doesn't support it.
 */
function normalizeThinking(
  thinking: AnthropicMessagesPayload["thinking"],
  maxTokens: number,
): Record<string, unknown> | undefined {
  if (!thinking) return undefined
  if (thinking.type === "adaptive") {
    return {
      type: "enabled",
      budget_tokens: Math.max(1024, maxTokens - 1),
    }
  }
  return thinking
}

/** Whitelist of optional fields safe to forward to Copilot /v1/messages */
const OPTIONAL_FIELDS = [
  "system",
  "metadata",
  "stop_sequences",
  "temperature",
  "top_p",
  "top_k",
  "tools",
  "tool_choice",
  "service_tier",
] as const

/**
 * Build a sanitized request body for the upstream Copilot /v1/messages endpoint.
 * Only forward fields that the Copilot API accepts — strip extras like
 * output_config that Claude Code sends but Copilot doesn't support.
 */
function buildNativeBody(
  payload: AnthropicMessagesPayload,
  overrides: Record<string, unknown>,
): Record<string, unknown> {
  const copilotModelId = anthropicToCopilotModelId(
    payload.model,
    state.is1MContext,
  )

  const body: Record<string, unknown> = {
    model: copilotModelId,
    messages: payload.messages,
    max_tokens: payload.max_tokens,
  }

  for (const field of OPTIONAL_FIELDS) {
    if (payload[field] !== undefined) {
      body[field] = payload[field]
    }
  }

  const thinking = normalizeThinking(payload.thinking, payload.max_tokens)
  if (thinking) body.thinking = thinking

  Object.assign(body, overrides)

  return body
}

/**
 * Forward a /v1/messages request directly to the upstream Copilot API's
 * native Anthropic /v1/messages endpoint, with only supported fields.
 */
export async function forwardNativeMessages(
  payload: AnthropicMessagesPayload,
  streamOverride?: boolean,
): Promise<Response> {
  const overrides: Record<string, unknown> = {}
  if (streamOverride !== undefined) overrides.stream = streamOverride

  const body = buildNativeBody(payload, overrides)

  const url = `${copilotBaseUrl(state)}/v1/messages`

  consola.debug(
    `Native passthrough: ${payload.model} -> ${body.model as string} via ${url}`,
  )

  const response = await fetch(url, {
    method: "POST",
    headers: copilotHeaders(state),
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    throw new HTTPError(
      `Native /v1/messages request failed for model ${body.model as string}`,
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
  const response = await forwardNativeMessages(payload, false)
  return await response.json()
}

/**
 * Forward a native /v1/messages request in streaming mode and yield SSE events.
 */
export async function* forwardNativeMessagesStreaming(
  payload: AnthropicMessagesPayload,
) {
  const response = await forwardNativeMessages(payload, true)

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
