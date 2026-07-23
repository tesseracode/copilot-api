import { describe, expect, it } from "bun:test"

import { parseCopilotPricingYaml, pricingForModel } from "~/lib/copilot-pricing"

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
    expect(pricing.source.etag).toBe('"fixture"')
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

  it("reports unmatched model names rather than guessing", () => {
    const pricing = parseCopilotPricingYaml(
      `${FIXTURE}\n- model: Future Model\n  input: $1\n  output: $2\n`,
    )
    expect(pricing.unmatched_models).toContain("Future Model")
  })

  it("rejects structurally empty sources", () => {
    expect(() => parseCopilotPricingYaml("[]")).toThrow(
      "Pricing source contains no model rows",
    )
  })
})
