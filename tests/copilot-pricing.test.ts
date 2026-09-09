import { describe, expect, it } from "bun:test"

import {
  parseCopilotPricingYaml,
  pricingNameToModelId,
  pricingEtagMatches,
  pricingForModel,
  publishCopilotPricing,
} from "~/lib/copilot-pricing"

const FIXTURE = `
- model: GPT-5.6 Sol
  provider: openai
  category: Powerful
  threshold: '≤ 272K'
  tier: Default
  input: $5.00
  cached_input: $0.50
  output: $30.00
- model: GPT-5.6 Sol
  provider: openai
  category: Powerful
  threshold: '> 272K'
  tier: 'Long context'
  input: $10.00
  cached_input: $1.00
  output: $45.00
- model: Claude Haiku 4.5
  provider: anthropic
  category: Versatile
  input: $1.00
  cached_input: $0.10
  output: $5.00
  cache_write: $1.25
`

describe("Copilot pricing parser", () => {
  it("parses default and long-context GPT pricing", () => {
    const pricing = parseCopilotPricingYaml(FIXTURE, {
      etag: '"fixture"',
      fetchedAt: "2026-01-01T00:00:00.000Z",
    })
    const sol = pricingForModel(pricing, "gpt-5.6-sol")

    expect(sol?.category).toBe("powerful")
    expect(sol?.tiers).toHaveLength(2)
    expect(sol?.tiers[0]).toMatchObject({
      name: "default",
      input_threshold: { operator: "lte", tokens: 272_000 },
      credits_per_1m: {
        input: 500,
        cache_read: 50,
        cache_write: null,
        output: 3000,
      },
    })
    expect(sol?.tiers[1]).toMatchObject({
      name: "long-context",
      input_threshold: { operator: "gt", tokens: 272_000 },
      credits_per_1m: { input: 1000, output: 4500 },
    })
    expect(pricing.source.upstream_etag).toBe('"fixture"')
    expect(pricing.source.version).toStartWith("sha256:")
  })

  it("parses Anthropic cache-write pricing", () => {
    const pricing = parseCopilotPricingYaml(FIXTURE)
    expect(
      pricingForModel(pricing, "claude-haiku-4.5")?.tiers[0],
    ).toMatchObject({
      credits_per_1m: {
        input: 100,
        cache_read: 10,
        cache_write: 125,
        output: 500,
      },
    })
  })

  // Reversal of an earlier "report unmatched rather than guess" rule. That
  // rule was conservative about billing data, but it was measured dropping
  // pricing for ten live models, two of which regressed only because a
  // promotion footnote appeared or disappeared. Deriving is inert when wrong,
  // since lookups are keyed by live catalog IDs and an entry for a model that
  // does not exist is never read; not deriving is silently wrong for models
  // that do exist.
  it("derives an ID for a well-formed unknown name", () => {
    const pricing = parseCopilotPricingYaml(
      `${FIXTURE}\n- model: Future Model\n  input: $1\n  output: $2\n`,
    )
    expect(pricing.unmatched_models).toEqual([])
    expect(pricingForModel(pricing, "future-model")).toBeTruthy()
  })

  it("attaches a derived entry to no other model", () => {
    const pricing = parseCopilotPricingYaml(
      `${FIXTURE}\n- model: Future Model\n  input: $1\n  output: $2\n`,
    )
    expect(pricingForModel(pricing, "gpt-5.6-sol")).toBeTruthy()
    expect(pricingForModel(pricing, "nonexistent-model")).toBeFalsy()
  })

  it("rejects structurally empty sources", () => {
    expect(() => parseCopilotPricingYaml("[]")).toThrow(
      "Pricing source contains no model rows",
    )
  })

  it("publishes only models in the accessible catalog without blocking others", () => {
    const pricing = parseCopilotPricingYaml(FIXTURE)
    const published = publishCopilotPricing(pricing, {
      object: "list",
      data: [
        {
          id: "gpt-5.6-sol",
          name: "GPT-5.6 Sol",
          object: "model",
          vendor: "openai",
          version: "1",
          preview: false,
          model_picker_enabled: true,
          capabilities: {
            family: "gpt",
            limits: {},
            object: "model_capabilities",
            supports: {},
            tokenizer: "test",
            type: "chat",
          },
        },
        {
          id: "accessible-without-price",
          name: "Accessible",
          object: "model",
          vendor: "test",
          version: "1",
          preview: false,
          model_picker_enabled: true,
          capabilities: {
            family: "test",
            limits: {},
            object: "model_capabilities",
            supports: {},
            tokenizer: "test",
            type: "chat",
          },
        },
      ],
    })

    expect(published.data.map((item) => item.model)).toEqual(["gpt-5.6-sol"])
    expect(published.diagnostics.accessible_without_pricing).toContain(
      "accessible-without-price",
    )
    expect(published.source.public_etag).toMatch(/^"[a-f0-9]{64}"$/)
  })

  it("keeps the public ETag stable across timestamp-only changes", () => {
    const pricing = parseCopilotPricingYaml(FIXTURE)
    const models = {
      object: "list" as const,
      data: [
        {
          id: "gpt-5.6-sol",
          name: "GPT-5.6 Sol",
          object: "model",
          vendor: "openai",
          version: "1",
          preview: false,
          model_picker_enabled: true,
          capabilities: {
            family: "gpt",
            limits: {},
            object: "model_capabilities",
            supports: {},
            tokenizer: "test",
            type: "chat",
          },
        },
      ],
    }
    const first = publishCopilotPricing(pricing, models)
    pricing.source.validated_at = "2099-01-01T00:00:00.000Z"
    pricing.source.last_attempt_at = "2099-01-01T00:00:00.000Z"
    const second = publishCopilotPricing(pricing, models)
    expect(second.source.public_etag).toBe(first.source.public_etag)
  })

  it("matches strong and weak conditional ETags", () => {
    expect(pricingEtagMatches('W/"abc", "other"', '"abc"')).toBe(true)
    expect(pricingEtagMatches('"other"', '"abc"')).toBe(false)
  })
})

describe("pricing display name derivation", () => {
  it("lowercases and dashes ordinary names", () => {
    expect(pricingNameToModelId("GPT-6 Astra")).toBe("gpt-6-astra")
    expect(pricingNameToModelId("Claude Opus 5")).toBe("claude-opus-5")
    expect(pricingNameToModelId("Grok 4.6")).toBe("grok-4.6")
    expect(pricingNameToModelId("GPT-5.4 mini")).toBe("gpt-5.4-mini")
    expect(pricingNameToModelId("MAI-Code-1.1-Flash")).toBe(
      "mai-code-1.1-flash",
    )
  })

  // Promotions add and remove these markers, which silently broke exact-string
  // aliases for Gemini 3.6 Flash and Claude Sonnet 5.
  it("strips markdown footnote markers", () => {
    expect(pricingNameToModelId("Gemini 3.6 Flash[^gemini-flash-promo]")).toBe(
      "gemini-3.6-flash",
    )
    expect(pricingNameToModelId("Claude Sonnet 5[^sonnet-5-promo]")).toBe(
      "claude-sonnet-5",
    )
  })

  it("is unaffected by a marker appearing or disappearing", () => {
    expect(pricingNameToModelId("Claude Sonnet 5")).toBe(
      pricingNameToModelId("Claude Sonnet 5[^sonnet-5-promo]"),
    )
  })

  it("attaches pricing for a model with no explicit alias", () => {
    const parsed = parseCopilotPricingYaml(`
- model: GPT-6 Astra
  provider: openai
  input: $1.00
  cached_input: $0.10
  output: $2.00
`)
    expect(pricingForModel(parsed, "gpt-6-astra")).toBeTruthy()
    expect(parsed.unmatched_models).toEqual([])
  })

  it("leaves a prose documentation row unattached", () => {
    const parsed = parseCopilotPricingYaml(`
- model: Claude Opus 4.8 (fast mode) (preview)
  provider: anthropic
  input: $1.00
  output: $2.00
`)
    expect(parsed.unmatched_models).toEqual([
      "Claude Opus 4.8 (fast mode) (preview)",
    ])
  })
})

describe("ambiguous derived model IDs", () => {
  const AMBIGUOUS = `
- model: Claude Sonnet 5
  input: $1.00
  output: $2.00
- model: Claude Sonnet 5[^sonnet-5-promo]
  input: $0.00
  output: $0.00
`

  it("refuses both rows rather than picking a price", () => {
    const parsed = parseCopilotPricingYaml(AMBIGUOUS)
    expect(parsed.data.map((row) => row.model)).toEqual([null, null])
    expect(pricingForModel(parsed, "claude-sonnet-5")).toBeUndefined()
  })

  it("preserves both display names as diagnostics", () => {
    const parsed = parseCopilotPricingYaml(AMBIGUOUS)
    expect(parsed.unmatched_models).toEqual([
      "Claude Sonnet 5",
      "Claude Sonnet 5[^sonnet-5-promo]",
    ])
  })

  it("never publishes duplicate rows for one model ID", () => {
    const parsed = parseCopilotPricingYaml(AMBIGUOUS)
    const published = publishCopilotPricing(parsed, {
      object: "list",
      data: [{ id: "claude-sonnet-5" }],
    } as never)
    const ids = published.data.map((row) => row.model)
    expect(new Set(ids).size).toBe(ids.length)
    expect(ids).not.toContain("claude-sonnet-5")
  })

  it("leaves unambiguous models in the same source untouched", () => {
    const parsed = parseCopilotPricingYaml(
      `${AMBIGUOUS}\n- model: GPT-6 Astra\n  input: $3.00\n  output: $4.00\n`,
    )
    expect(pricingForModel(parsed, "gpt-6-astra")).toBeTruthy()
  })

  it("still resolves a single footnoted name with no plain twin", () => {
    const parsed = parseCopilotPricingYaml(
      `- model: Gemini 3.6 Flash[^gemini-flash-promo]\n  input: $1\n  output: $2\n`,
    )
    expect(pricingForModel(parsed, "gemini-3.6-flash")).toBeTruthy()
    expect(parsed.unmatched_models).toEqual([])
  })

  it("treats an explicit alias colliding with a derived name as ambiguous", () => {
    const parsed = parseCopilotPricingYaml(
      `- model: MAI-Code-1-Flash\n  input: $1\n  output: $2\n- model: mai code 1 flash picker\n  input: $9\n  output: $9\n`,
    )
    expect(pricingForModel(parsed, "mai-code-1-flash-picker")).toBeUndefined()
    expect(parsed.unmatched_models).toHaveLength(2)
  })

  it("reports each unmatched display name once", () => {
    const parsed = parseCopilotPricingYaml(AMBIGUOUS)
    expect(parsed.unmatched_models).toEqual([
      ...new Set(parsed.unmatched_models),
    ])
  })
})

/**
 * The parse-time guard cannot help a cache that was written to disk before
 * that guard existed, so the publish boundary re-checks what it was handed.
 */
function staleCache() {
  return {
    object: "pricing.list",
    provider: "github-copilot",
    currency: "USD",
    unit: "per_1m_tokens",
    credit: { usd_per_credit: 0.01 },
    source: {
      url: "x",
      version: "sha256:x",
      fetched_at: "",
      validated_at: "",
      stale: false,
    },
    data: [
      {
        model: "claude-sonnet-5",
        display_name: "Claude Sonnet 5",
        tiers: [],
      },
      {
        model: "claude-sonnet-5",
        display_name: "Claude Sonnet 5[^promo]",
        tiers: [],
      },
      { model: "gpt-6-astra", display_name: "GPT-6 Astra", tiers: [] },
    ],
    unmatched_models: [],
  } as never
}

describe("a stale cache carrying duplicate model IDs", () => {
  it("publishes no duplicate rows", () => {
    const published = publishCopilotPricing(staleCache(), {
      object: "list",
      data: [{ id: "claude-sonnet-5" }, { id: "gpt-6-astra" }],
    } as never)
    const ids = published.data.map((row) => row.model)
    expect(new Set(ids).size).toBe(ids.length)
    expect(ids).not.toContain("claude-sonnet-5")
  })

  it("still publishes the unambiguous models in that cache", () => {
    const published = publishCopilotPricing(staleCache(), {
      object: "list",
      data: [{ id: "claude-sonnet-5" }, { id: "gpt-6-astra" }],
    } as never)
    expect(published.data.map((row) => row.model)).toContain("gpt-6-astra")
  })

  it("deduplicates the mapped_but_inaccessible diagnostic", () => {
    const published = publishCopilotPricing(staleCache(), {
      object: "list",
      data: [{ id: "gpt-6-astra" }],
    } as never)
    expect(published.diagnostics.mapped_but_inaccessible).toEqual([
      "claude-sonnet-5",
    ])
  })
})
