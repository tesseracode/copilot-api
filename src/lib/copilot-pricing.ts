import { createHash } from "node:crypto"
import fs from "node:fs/promises"
import path from "node:path"
import { parse } from "yaml"

import type { ModelsResponse } from "~/services/copilot/get-models"

import { PATHS } from "./paths"

export const COPILOT_PRICING_SOURCE =
  "https://raw.githubusercontent.com/github/docs/main/data/tables/copilot/models-and-pricing.yml"

/**
 * Explicit overrides, for pricing rows whose display name does not reduce to
 * the catalog model ID. The derived rule below covers every ordinary name, so
 * this map only needs an entry when a model breaks the pattern.
 */
const MODEL_ALIASES: Record<string, string> = {
  "Gemini 3 Flash": "gemini-3-flash-preview",
  "Gemini 3.1 Pro": "gemini-3.1-pro-preview",
  "MAI-Code-1-Flash": "mai-code-1-flash-picker",
}

/**
 * Reduce a pricing-table display name to a catalog model ID.
 *
 * The pricing table is documentation, so names carry markdown footnote markers
 * that come and go with promotions — `Claude Sonnet 5[^sonnet-5-promo]` lost
 * its marker and `Gemini 3.6 Flash` gained one, and each change silently broke
 * an exact-string alias. Deriving the ID keeps pricing attached across those
 * edits and across newly released models.
 */
export function pricingNameToModelId(displayName: string): string {
  const withoutFootnotes = displayName.replaceAll(/\[\^[^\]]*\]/g, "")
  return withoutFootnotes.trim().toLowerCase().replaceAll(/\s+/g, "-")
}

/** Characters a Copilot model ID is made of. */
const MODEL_ID_SHAPE = /^[a-z0-9.-]+$/

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
    upstream_etag?: string
    public_etag?: string
    fetched_at: string
    validated_at: string
    stale: boolean
    error?: string
    last_attempt_at?: string
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
  const rows = parse(yaml) as Array<RawPricingRow>
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

  // Footnote stripping is many-to-one, so a table carrying both "Claude
  // Sonnet 5" and "Claude Sonnet 5[^promo]" would derive one ID twice and
  // publish duplicate rows. Their prices differ by design — a promotion row
  // is often $0.00 — so picking either one would state a confident wrong
  // price. Refuse both and report them instead.
  const derivedFor = new Map<string, string>()
  const collidingIds = new Set<string>()
  for (const displayName of grouped.keys()) {
    const derived =
      MODEL_ALIASES[displayName] ?? pricingNameToModelId(displayName)
    if (!MODEL_ID_SHAPE.test(derived)) continue
    if (derivedFor.has(derived)) collidingIds.add(derived)
    derivedFor.set(derived, displayName)
  }

  const data = [...grouped.entries()].map(([displayName, modelRows]) => {
    const derived =
      MODEL_ALIASES[displayName] ?? pricingNameToModelId(displayName)
    // A derived name that still carries prose (e.g. "(fast mode) (preview)")
    // is a documentation row rather than a model, so it stays unattached.
    const model =
      MODEL_ID_SHAPE.test(derived) && !collidingIds.has(derived) ?
        derived
      : null
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
      upstream_etag: metadata.etag,
      fetched_at: now,
      validated_at: now,
      stale: false,
    },
    data,
    unmatched_models: [...new Set(unmatched)],
  }
}

export async function readCopilotPricing(
  cachePath = PATHS.COPILOT_PRICING_PATH,
): Promise<CopilotPricingCache | undefined> {
  try {
    return JSON.parse(
      (await fs.readFile(cachePath)).toString("utf8"),
    ) as CopilotPricingCache
  } catch {
    return undefined
  }
}

export async function writeCopilotPricing(
  cache: CopilotPricingCache,
  cachePath = PATHS.COPILOT_PRICING_PATH,
): Promise<void> {
  await fs.mkdir(path.dirname(cachePath), { recursive: true })
  const temporaryPath = `${cachePath}.tmp-${process.pid}`
  await fs.writeFile(temporaryPath, `${JSON.stringify(cache, null, 2)}\n`, {
    mode: 0o600,
  })
  await fs.rename(temporaryPath, cachePath)
}

export async function updateCopilotPricing(
  fetcher: typeof fetch = fetch,
  cachePath = PATHS.COPILOT_PRICING_PATH,
): Promise<{
  status: "updated" | "not-modified" | "stale"
  cache?: CopilotPricingCache
}> {
  const existing = await readCopilotPricing(cachePath)
  try {
    const response = await fetcher(COPILOT_PRICING_SOURCE, {
      headers:
        existing?.source.upstream_etag ?
          { "if-none-match": existing.source.upstream_etag }
        : undefined,
      signal: AbortSignal.timeout(30_000),
    })
    if (response.status === 304 && existing) {
      const recovered = structuredClone(existing)
      recovered.source.validated_at = new Date().toISOString()
      recovered.source.stale = false
      delete recovered.source.error
      await writeCopilotPricing(recovered, cachePath)
      return { status: "not-modified", cache: recovered }
    }
    if (!response.ok)
      throw new Error(`Pricing fetch failed with HTTP ${response.status}`)
    const cache = parseCopilotPricingYaml(await response.text(), {
      etag: response.headers.get("etag") ?? undefined,
    })
    await writeCopilotPricing(cache, cachePath)
    return { status: "updated", cache }
  } catch (error) {
    if (!existing) throw error
    const stale = structuredClone(existing)
    stale.source.last_attempt_at = new Date().toISOString()
    stale.source.stale = true
    stale.source.error = error instanceof Error ? error.message : String(error)
    await writeCopilotPricing(stale, cachePath)
    return { status: "stale", cache: stale }
  }
}

export interface PublishedPricing extends CopilotPricingCache {
  diagnostics: {
    mapped_but_inaccessible: Array<string>
    accessible_without_pricing: Array<string>
  }
}

export function publishCopilotPricing(
  cache: CopilotPricingCache,
  models: ModelsResponse | undefined,
): PublishedPricing {
  const accessible = new Set(models?.data.map((model) => model.id) ?? [])
  // A cache written before collision detection existed can still hold
  // duplicate model IDs on disk, so the publish boundary re-checks rather
  // than trusting the parse. Refusing every copy matches the parse-time
  // decision: with two prices for one ID, neither can be shown to be right.
  const duplicateIds = new Set(
    cache.data
      .map((item) => item.model)
      .filter(
        (model, index, all): model is string =>
          Boolean(model) && all.indexOf(model) !== index,
      ),
  )
  const publishedData = cache.data.filter(
    (item): item is CopilotModelPricing & { model: string } =>
      Boolean(
        item.model
          && accessible.has(item.model)
          && !duplicateIds.has(item.model),
      ),
  )
  const priced = new Set(publishedData.map((item) => item.model))
  const mappedButInaccessible = [
    ...new Set(
      cache.data.flatMap((item) =>
        item.model && !accessible.has(item.model) ? [item.model] : [],
      ),
    ),
  ]
  const accessibleWithoutPricing = [...accessible].filter(
    (model) => !priced.has(model),
  )
  const publicEtag = `"${createHash("sha256")
    .update(
      JSON.stringify({
        source_version: cache.source.version,
        stale: cache.source.stale,
        error: cache.source.error,
        data: publishedData,
        unmatched_models: cache.unmatched_models,
        mapped_but_inaccessible: mappedButInaccessible,
        accessible_without_pricing: accessibleWithoutPricing,
      }),
    )
    .digest("hex")}"`
  return {
    ...cache,
    source: { ...cache.source, public_etag: publicEtag },
    data: publishedData,
    diagnostics: {
      mapped_but_inaccessible: mappedButInaccessible,
      accessible_without_pricing: accessibleWithoutPricing,
    },
  }
}

export function pricingEtagMatches(
  ifNoneMatch: string | undefined,
  etag: string,
): boolean {
  return (
    ifNoneMatch
      ?.split(",")
      .map((value) => value.trim().replace(/^W\//, ""))
      .includes(etag) ?? false
  )
}

export function pricingForModel(
  cache: CopilotPricingCache | undefined,
  modelId: string,
): CopilotModelPricing | undefined {
  return cache?.data.find((item) => item.model === modelId)
}
