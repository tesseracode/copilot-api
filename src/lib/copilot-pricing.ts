import { createHash } from "node:crypto"
import fs from "node:fs/promises"

import { PATHS } from "./paths"

export const COPILOT_PRICING_SOURCE =
  "https://raw.githubusercontent.com/github/docs/main/data/tables/copilot/models-and-pricing.yml"

const MODEL_ALIASES: Record<string, string> = {
  "GPT-5 mini": "gpt-5-mini",
  "GPT-5.3-Codex": "gpt-5.3-codex",
  "GPT-5.4": "gpt-5.4",
  "GPT-5.4 mini": "gpt-5.4-mini",
  "GPT-5.5": "gpt-5.5",
  "GPT-5.6 Luna": "gpt-5.6-luna",
  "GPT-5.6 Sol": "gpt-5.6-sol",
  "GPT-5.6 Terra": "gpt-5.6-terra",
  "Claude Haiku 4.5": "claude-haiku-4.5",
  "Claude Sonnet 4.5": "claude-sonnet-4.5",
  "Claude Sonnet 4.6": "claude-sonnet-4.6",
  "Claude Opus 4.6": "claude-opus-4.6",
  "Claude Opus 4.7": "claude-opus-4.7",
  "Claude Opus 4.8": "claude-opus-4.8",
  "Claude Sonnet 5[^sonnet-5-promo]": "claude-sonnet-5",
  "Gemini 2.5 Pro": "gemini-2.5-pro",
  "Gemini 3 Flash": "gemini-3-flash-preview",
  "Gemini 3.1 Pro": "gemini-3.1-pro-preview",
  "Gemini 3.5 Flash": "gemini-3.5-flash",
  "Gemini 3.6 Flash": "gemini-3.6-flash",
  "MAI-Code-1-Flash": "mai-code-1-flash-picker",
}

interface RawPricingRow {
  model?: string
  input?: string | number
  cached_input?: string | number
  cache_write?: string | number
  output?: string | number
  threshold?: string
  tier?: string
  category?: string
}

export interface PricingTier {
  name: "default" | "long-context"
  input_threshold?: { operator: "lte" | "gt"; tokens: number }
  usd_per_1m: {
    input: number | null
    cache_read: number | null
    cache_write: number | null
    output: number | null
  }
  credits_per_1m: {
    input: number | null
    cache_read: number | null
    cache_write: number | null
    output: number | null
  }
}

export interface CopilotModelPricing {
  model: string | null
  display_name: string
  category?: string
  tiers: Array<PricingTier>
}

export interface CopilotPricingCache {
  object: "pricing.list"
  provider: "github-copilot"
  currency: "USD"
  unit: "per_1m_tokens"
  credit: { usd_per_credit: 0.01 }
  source: {
    url: string
    version: string
    etag?: string
    fetched_at: string
    validated_at: string
    stale: boolean
    error?: string
  }
  data: Array<CopilotModelPricing>
  unmatched_models: Array<string>
}

function parsePrice(value: string | number | undefined): number | null {
  if (typeof value === "number") return value
  if (!value || value === "Not applicable") return null
  const parsed = Number(value.replaceAll(/[$,]/g, ""))
  return Number.isFinite(parsed) ? parsed : null
}

function parseThreshold(
  value: string | undefined,
): PricingTier["input_threshold"] {
  if (!value) return undefined
  const match = value.match(/(≤|>)\s*([\d.]+)K/)
  if (!match) return undefined
  return {
    operator: match[1] === "≤" ? "lte" : "gt",
    tokens: Math.round(Number(match[2]) * 1000),
  }
}

function toCredits(value: number | null): number | null {
  return value === null ? null : value / 0.01
}

export function parseCopilotPricingYaml(
  yaml: string,
  metadata: { etag?: string; fetchedAt?: string } = {},
): CopilotPricingCache {
  const rows = Bun.YAML.parse(yaml) as Array<RawPricingRow>
  if (rows.length === 0)
    throw new Error("Pricing source contains no model rows")

  const grouped = new Map<string, Array<RawPricingRow>>()
  for (const row of rows) {
    if (!row.model || row.input === undefined || row.output === undefined) {
      throw new Error("Pricing row is missing required fields")
    }
    const modelName = row.model
    const validRow = row as RawPricingRow & {
      model: string
      input: string | number
      output: string | number
    }
    grouped.set(modelName, [...(grouped.get(modelName) ?? []), validRow])
  }

  const unmatched: Array<string> = []
  const data = [...grouped.entries()].map(([displayName, modelRows]) => {
    const model = MODEL_ALIASES[displayName] ?? null
    if (!model) unmatched.push(displayName)
    const tiers = modelRows.map((row, index): PricingTier => {
      const input = parsePrice(row.input)
      const cacheRead = parsePrice(row.cached_input)
      const cacheWrite = parsePrice(row.cache_write)
      const output = parsePrice(row.output)
      return {
        name:
          row.tier?.toLowerCase().includes("long") || index > 0 ?
            "long-context"
          : "default",
        input_threshold: parseThreshold(row.threshold),
        usd_per_1m: {
          input,
          cache_read: cacheRead,
          cache_write: cacheWrite,
          output,
        },
        credits_per_1m: {
          input: toCredits(input),
          cache_read: toCredits(cacheRead),
          cache_write: toCredits(cacheWrite),
          output: toCredits(output),
        },
      }
    })
    return {
      model,
      display_name: displayName,
      category: modelRows[0].category?.toLowerCase(),
      tiers,
    }
  })

  const now = metadata.fetchedAt ?? new Date().toISOString()
  return {
    object: "pricing.list",
    provider: "github-copilot",
    currency: "USD",
    unit: "per_1m_tokens",
    credit: { usd_per_credit: 0.01 },
    source: {
      url: COPILOT_PRICING_SOURCE,
      version: `sha256:${createHash("sha256").update(yaml).digest("hex")}`,
      etag: metadata.etag,
      fetched_at: now,
      validated_at: now,
      stale: false,
    },
    data,
    unmatched_models: unmatched,
  }
}

export async function readCopilotPricing(): Promise<
  CopilotPricingCache | undefined
> {
  try {
    return JSON.parse(
      await fs.readFile(PATHS.COPILOT_PRICING_PATH),
    ) as CopilotPricingCache
  } catch {
    return undefined
  }
}

export async function writeCopilotPricing(
  cache: CopilotPricingCache,
): Promise<void> {
  await fs.mkdir(PATHS.APP_DIR, { recursive: true })
  const temporaryPath = `${PATHS.COPILOT_PRICING_PATH}.tmp-${process.pid}`
  await fs.writeFile(temporaryPath, `${JSON.stringify(cache, null, 2)}\n`, {
    mode: 0o600,
  })
  await fs.rename(temporaryPath, PATHS.COPILOT_PRICING_PATH)
}

export async function updateCopilotPricing(
  fetcher: typeof fetch = fetch,
): Promise<{
  status: "updated" | "not-modified" | "stale"
  cache?: CopilotPricingCache
}> {
  const existing = await readCopilotPricing()
  try {
    const response = await fetcher(COPILOT_PRICING_SOURCE, {
      headers:
        existing?.source.etag ?
          { "if-none-match": existing.source.etag }
        : undefined,
      signal: AbortSignal.timeout(30_000),
    })
    if (response.status === 304 && existing) {
      existing.source.validated_at = new Date().toISOString()
      existing.source.stale = false
      delete existing.source.error
      await writeCopilotPricing(existing)
      return { status: "not-modified", cache: existing }
    }
    if (!response.ok)
      throw new Error(`Pricing fetch failed with HTTP ${response.status}`)
    const cache = parseCopilotPricingYaml(await response.text(), {
      etag: response.headers.get("etag") ?? undefined,
    })
    await writeCopilotPricing(cache)
    return { status: "updated", cache }
  } catch (error) {
    if (!existing) throw error
    existing.source.stale = true
    existing.source.error =
      error instanceof Error ? error.message : String(error)
    await writeCopilotPricing(existing)
    return { status: "stale", cache: existing }
  }
}

export function pricingForModel(
  cache: CopilotPricingCache | undefined,
  modelId: string,
): CopilotModelPricing | undefined {
  return cache?.data.find((item) => item.model === modelId)
}
