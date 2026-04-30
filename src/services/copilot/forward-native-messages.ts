import consola from "consola"
import { events } from "fetch-event-stream"

import type { AnthropicMessagesPayload } from "~/routes/messages/anthropic-types"

import { copilotBaseUrl, copilotHeaders } from "~/lib/api-config"
import { HTTPError } from "~/lib/error"
import { anthropicToCopilotModelId } from "~/lib/model-mapping"
import { state } from "~/lib/state"

/**
 * Detect Claude model generation from the copilot model ID.
 *
 * Thinking type support varies by generation:
 *   Older (haiku-4.5, sonnet-4/4.5, opus-4.5): disabled, enabled
 *   4.6   (sonnet-4.6, opus-4.6[-1m]):          disabled, enabled, adaptive
 *   4.7+  (opus-4.7[-1m-internal]):              disabled, adaptive (rejects enabled)
 *
 * Future models default to adaptive (the trend is clear).
 */
type ModelGeneration = "older" | "4.6" | "4.7+"

/** Models that only accept enabled (not adaptive) */
const OLDER_MODELS = ["haiku-4.5", "sonnet-4.5", "sonnet-4", "opus-4.5"]

function detectGeneration(copilotModelId: string): ModelGeneration {
  // Check older models first (allowlist approach)
  if (OLDER_MODELS.some((m) => copilotModelId.includes(m))) return "older"
  if (copilotModelId.includes("4.6")) return "4.6"
  // 4.7 and all future models default to adaptive
  return "4.7+"
}

/**
 * Compute a thinking budget from effort level and max_tokens.
 */
function budgetFromEffort(
  effort: string | undefined,
  maxTokens: number,
  existingBudget: number | undefined,
): number {
  let budget: number
  switch (effort) {
    case "low": {
      return 0
    } // caller handles this as disabled
    case "medium": {
      budget = existingBudget ?? Math.max(1024, Math.floor(maxTokens * 0.5))
      break
    }
    case "high": {
      budget = existingBudget ?? Math.max(1024, Math.floor(maxTokens * 0.8))
      break
    }
    case "max": {
      budget = Math.max(1024, maxTokens - 1)
      break
    }
    default: {
      budget = existingBudget ?? Math.max(1024, maxTokens - 1)
    }
  }
  // budget_tokens must be strictly less than max_tokens
  return Math.min(budget, maxTokens - 1)
}

interface NormalizeThinkingOpts {
  thinking: AnthropicMessagesPayload["thinking"]
  maxTokens: number
  generation: ModelGeneration
  effort?: "low" | "medium" | "high" | "max"
}

/**
 * Normalize thinking config for the upstream Copilot /v1/messages endpoint.
 *
 * Applies per-generation rules:
 *   - Older models: downgrade adaptive → enabled (they reject adaptive)
 *   - 4.6 models: pass through as-is (they accept everything)
 *   - 4.7 models: upgrade enabled → adaptive (they reject enabled)
 *
 * Also maps output_config.effort to budget_tokens.
 */
function normalizeThinking(
  opts: NormalizeThinkingOpts,
): Record<string, unknown> | undefined {
  const { thinking, maxTokens, generation, effort } = opts
  // Low effort: disable thinking entirely regardless of generation
  if (effort === "low") {
    return { type: "disabled" }
  }

  // If no thinking config and no effort signal, nothing to do
  if (!thinking && !effort) return undefined

  const requestedType = thinking?.type ?? "enabled"

  // Disabled is universally supported
  if (requestedType === "disabled") return thinking

  const budgetTokens = budgetFromEffort(
    effort,
    maxTokens,
    thinking?.budget_tokens,
  )

  switch (generation) {
    case "4.6": {
      // 4.6 accepts everything — pass through type as-is
      // adaptive does NOT accept budget_tokens, only enabled does
      if (requestedType === "adaptive") {
        return { type: "adaptive" }
      }
      return { type: "enabled", budget_tokens: budgetTokens }
    }

    case "4.7+": {
      // 4.7+ rejects 'enabled' — must use adaptive (no budget_tokens)
      return { type: "adaptive" }
    }

    default: {
      // Older models reject 'adaptive' — must use enabled
      return { type: "enabled", budget_tokens: budgetTokens }
    }
  }
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
 * Map effort level to a model ID suffix for models that encode effort in the ID.
 * Returns null for effort levels that don't need a suffix upgrade.
 */
function resolveEffortSuffix(effort: string): string | null {
  switch (effort) {
    case "high": {
      return "-high"
    }
    case "max":
    case "xhigh": {
      return "-xhigh"
    }
    default: {
      return null
    } // low/medium don't have dedicated variants
  }
}

/**
 * Check whether a model supports output_config.effort.
 * Only 4.6 and 4.7-1m models support it; older and 4.7 base do not.
 */
function supportsEffort(
  generation: ModelGeneration,
  copilotModelId: string,
): boolean {
  if (generation === "4.6") return true
  // 4.7-1m-internal supports effort, but 4.7 base does not
  if (generation === "4.7+" && copilotModelId.includes("-1m")) return true
  return false
}

interface ResolveEffortOpts {
  copilotModelId: string
  generation: ModelGeneration
  effort: string | undefined
  body: Record<string, unknown>
  outputConfig: Record<string, unknown> | undefined
}

/**
 * Resolve effort by upgrading the model ID or forwarding output_config.
 * Returns whether effort was handled.
 */
function resolveEffort(opts: ResolveEffortOpts): boolean {
  const { copilotModelId, generation, effort, body, outputConfig } = opts
  if (!effort) return false

  // Models that accept output_config.effort natively
  if (supportsEffort(generation, copilotModelId)) {
    const normalizedEffort = effort === "max" ? "xhigh" : effort
    body.output_config = { ...outputConfig, effort: normalizedEffort }
    return true
  }

  // Try upgrading to -high/-xhigh variant
  const suffix = resolveEffortSuffix(effort)
  if (suffix) {
    const candidate = `${copilotModelId}${suffix}`
    if (state.models?.data.some((m) => m.id === candidate)) {
      consola.debug(
        `Effort upgrade: ${copilotModelId} → ${candidate} (effort=${effort})`,
      )
      body.model = candidate
      return true
    }
  }

  return false
}

/**
 * Build a sanitized request body for the upstream Copilot /v1/messages endpoint.
 * Only forward fields that the Copilot API accepts — strip extras like
 * output_config that Claude Code sends but Copilot doesn't support.
 */
export function buildNativeBody(
  payload: AnthropicMessagesPayload,
  overrides: Record<string, unknown>,
  is1M?: boolean,
): Record<string, unknown> {
  const copilotModelId = anthropicToCopilotModelId(
    payload.model,
    is1M ?? state.is1MContext,
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

  // Sanitize stop_sequences: Copilot rejects whitespace-only entries (e.g. "\n" from Buddy)
  if (body.stop_sequences) {
    const filtered = (body.stop_sequences as Array<string>).filter((s) =>
      s.trim(),
    )
    if (filtered.length > 0) {
      body.stop_sequences = filtered
    } else {
      delete body.stop_sequences
    }
  }

  const effort = payload.output_config?.effort
  const generation = detectGeneration(copilotModelId)

  const effortHandled = resolveEffort({
    copilotModelId,
    generation,
    effort,
    body,
    outputConfig: payload.output_config,
  })

  const thinking = normalizeThinking({
    thinking: payload.thinking,
    maxTokens: payload.max_tokens,
    generation,
    effort: effortHandled ? undefined : effort,
  })
  if (thinking) body.thinking = thinking

  Object.assign(body, overrides)

  return body
}

/**
 * Forward a /v1/messages request directly to the upstream Copilot API's
 * native Anthropic /v1/messages endpoint, with only supported fields.
 */
// eslint-disable-next-line max-params
export async function forwardNativeMessages(
  payload: AnthropicMessagesPayload,
  streamOverride?: boolean,
  is1M?: boolean,
  signal?: AbortSignal,
): Promise<Response> {
  const overrides: Record<string, unknown> = {}
  if (streamOverride !== undefined) overrides.stream = streamOverride

  const body = buildNativeBody(payload, overrides, is1M)

  const url = `${copilotBaseUrl(state)}/v1/messages`

  consola.debug(
    `Native passthrough: ${payload.model} -> ${body.model as string} via ${url}`,
  )

  const response = await fetch(url, {
    method: "POST",
    headers: copilotHeaders(state),
    body: JSON.stringify(body),
    signal,
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
  is1M?: boolean,
  signal?: AbortSignal,
) {
  const response = await forwardNativeMessages(payload, false, is1M, signal)
  return await response.json()
}

/**
 * Forward a native /v1/messages request in streaming mode and yield SSE events.
 */
export async function* forwardNativeMessagesStreaming(
  payload: AnthropicMessagesPayload,
  is1M?: boolean,
  signal?: AbortSignal,
) {
  const response = await forwardNativeMessages(payload, true, is1M, signal)

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
