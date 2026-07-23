import type { ChatCompletionsPayload } from "~/services/copilot/create-chat-completions"
import type { Model } from "~/services/copilot/get-models"

export type ProbeCaseName =
  | "control"
  | "prompt-over"
  | "combined-over"
  | "output-over"

export interface ProbeCase {
  name: ProbeCaseName
  targetInputTokens: number
  requestedOutputTokens: number
  expectation: "accept" | "reject" | "not-applicable"
  reason?: string
}

export interface CopilotUsage {
  token_details: Array<{
    batch_size: number
    cost_per_batch: number
    token_count: number
    token_type: string
  }>
  total_nano_aiu: number
}

export interface ProbeResult {
  case: ProbeCaseName
  dimension: "direct" | "proxy"
  status: number | null
  ok: boolean
  error?: string
  usage?: Record<string, unknown>
  copilotUsage?: CopilotUsage
  durationMs: number
  headers: Record<string, string>
}

export function buildProbeCases(model: Model, margin = 32): Array<ProbeCase> {
  const limits = model.capabilities.limits
  const context = limits.max_context_window_tokens
  const prompt = limits.max_prompt_tokens
  const output = limits.max_output_tokens
  if (!context || !prompt || !output) {
    throw new Error(`Model ${model.id} has incomplete context limits`)
  }

  const combinedInput = context - output + margin
  const combinedApplicable = combinedInput <= prompt && combinedInput > 0

  return [
    {
      name: "control",
      targetInputTokens: Math.min(512, Math.max(32, prompt - margin)),
      requestedOutputTokens: Math.min(16, output),
      expectation: "accept",
    },
    {
      name: "prompt-over",
      targetInputTokens: prompt + margin,
      requestedOutputTokens: Math.min(16, output),
      expectation: "reject",
    },
    {
      name: "combined-over",
      targetInputTokens: combinedApplicable ? combinedInput : 0,
      requestedOutputTokens: combinedApplicable ? output : 0,
      expectation: combinedApplicable ? "reject" : "not-applicable",
      reason:
        combinedApplicable ? undefined : (
          "No prompt/output pair can exceed context while both stay within advertised limits"
        ),
    },
    {
      name: "output-over",
      targetInputTokens: Math.min(128, Math.max(32, prompt - margin)),
      requestedOutputTokens: output + margin,
      expectation: "reject",
    },
  ]
}

export function makePrompt(units: number): string {
  return Array.from(
    { length: Math.max(1, units) },
    (_, index) =>
      `boundary_${index.toString(36)} value_${(index * 7919).toString(36)}`,
  ).join(" ")
}

export async function calibratePrompt(
  targetTokens: number,
  count: (content: string) => Promise<number>,
): Promise<{ content: string; estimatedTokens: number }> {
  let low = 1
  let high = Math.max(2, targetTokens)
  while ((await count(makePrompt(high))) < targetTokens) high *= 2

  while (low < high) {
    const middle = Math.floor((low + high) / 2)
    if ((await count(makePrompt(middle))) < targetTokens) low = middle + 1
    else high = middle
  }

  const candidates = [Math.max(1, low - 1), low]
  const measured = await Promise.all(
    candidates.map(async (units) => {
      const content = makePrompt(units)
      return { content, estimatedTokens: await count(content) }
    }),
  )
  return measured.reduce((best, item) =>
    (
      Math.abs(item.estimatedTokens - targetTokens)
      < Math.abs(best.estimatedTokens - targetTokens)
    ) ?
      item
    : best,
  )
}

export function buildChatPayload(
  model: string,
  content: string,
  outputTokens: number,
): ChatCompletionsPayload {
  return {
    model,
    messages: [{ role: "user", content }],
    max_tokens: outputTokens,
    stream: false,
  }
}

function isTransient(result: ProbeResult): boolean {
  return result.status === null || result.status === 429 || result.status >= 500
}

export function classifyPair(
  direct: ProbeResult | undefined,
  proxy: ProbeResult | undefined,
): string {
  if (!direct || !proxy || isTransient(direct) || isTransient(proxy)) {
    return "inconclusive"
  }
  if (direct.ok && proxy.ok) return "accepted-by-upstream"
  if (!direct.ok && !proxy.ok) return "both-enforced"
  if (!direct.ok && proxy.ok) return "proxy-preflight-or-workaround"
  if (direct.ok && !proxy.ok) return "proxy-regression"
  return "inconclusive"
}

export function extractUsage(
  body: unknown,
): Record<string, unknown> | undefined {
  if (!body || typeof body !== "object") return undefined
  const usage = (body as Record<string, unknown>).usage
  return usage && typeof usage === "object" ?
      (usage as Record<string, unknown>)
    : undefined
}

export function extractCopilotUsage(body: unknown): CopilotUsage | undefined {
  if (!body || typeof body !== "object") return undefined
  const usage = (body as Record<string, unknown>).copilot_usage
  if (!usage || typeof usage !== "object") return undefined
  const record = usage as Record<string, unknown>
  return (
      Array.isArray(record.token_details)
        && typeof record.total_nano_aiu === "number"
    ) ?
      (record as unknown as CopilotUsage)
    : undefined
}

export function calculateNanoAiu(usage: CopilotUsage): number {
  return usage.token_details.reduce(
    (total, detail) =>
      total + (detail.token_count * detail.cost_per_batch) / detail.batch_size,
    0,
  )
}

export function nanoAiuToAiu(nanoAiu: number): number {
  return nanoAiu / 1_000_000_000
}

export function creditDelta(
  before: unknown,
  after: unknown,
): number | undefined {
  const read = (value: unknown): number | undefined => {
    if (!value || typeof value !== "object") return undefined
    const snapshots = (value as Record<string, unknown>).quota_snapshots
    if (!snapshots || typeof snapshots !== "object") return undefined
    const premium = (snapshots as Record<string, unknown>).premium_interactions
    if (!premium || typeof premium !== "object") return undefined
    const credits = (premium as Record<string, unknown>).credits_used
    return typeof credits === "number" ? credits : undefined
  }
  const start = read(before)
  const end = read(after)
  return start === undefined || end === undefined ? undefined : end - start
}
