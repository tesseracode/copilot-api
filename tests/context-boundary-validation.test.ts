import { describe, expect, it } from "bun:test"

import type { Model } from "~/services/copilot/get-models"

import {
  buildProbeCases,
  calculateNanoAiu,
  calibratePrompt,
  classifyPair,
  creditDelta,
  extractCopilotUsage,
  extractUsage,
  nanoAiuToAiu,
  type ProbeResult,
} from "../scripts/lib/context-boundary"

function model(
  overrides: Partial<Model["capabilities"]["limits"]> = {},
): Model {
  return {
    id: "tiny",
    name: "Tiny",
    object: "model",
    vendor: "test",
    version: "1",
    preview: false,
    model_picker_enabled: true,
    capabilities: {
      family: "tiny",
      limits: {
        max_context_window_tokens: 100,
        max_prompt_tokens: 80,
        max_output_tokens: 30,
        ...overrides,
      },
      object: "model_capabilities",
      supports: {},
      tokenizer: "test",
      type: "chat",
    },
  }
}

function quotaUsage(credits: number) {
  return {
    quota_snapshots: { premium_interactions: { credits_used: credits } },
  }
}

function result(ok: boolean, dimension: "direct" | "proxy"): ProbeResult {
  return {
    case: "control",
    dimension,
    status: ok ? 200 : 400,
    ok,
    durationMs: 1,
    headers: {},
  }
}

describe("context boundary matrix", () => {
  it("builds all four boundary cases", () => {
    const cases = buildProbeCases(model(), 5)
    expect(cases.map((item) => item.name)).toEqual([
      "control",
      "prompt-over",
      "combined-over",
      "output-over",
    ])
    expect(cases[1].targetInputTokens).toBe(85)
    expect(cases[2]).toMatchObject({
      targetInputTokens: 75,
      requestedOutputTokens: 30,
      expectation: "reject",
    })
    expect(cases[3].requestedOutputTokens).toBe(35)
  })

  it("marks combined overflow impossible when legal values cannot exceed context", () => {
    const combined = buildProbeCases(
      model({
        max_context_window_tokens: 200,
        max_prompt_tokens: 80,
        max_output_tokens: 30,
      }),
      5,
    )[2]
    expect(combined.expectation).toBe("not-applicable")
  })

  it("calibrates generated content around a target", async () => {
    const calibrated = await calibratePrompt(100, (content) =>
      Promise.resolve(content.split(" ").length),
    )
    expect(Math.abs(calibrated.estimatedTokens - 100)).toBeLessThanOrEqual(2)
  })
})

describe("context result reporting", () => {
  it("classifies direct and proxy outcomes", () => {
    expect(classifyPair(result(true, "direct"), result(true, "proxy"))).toBe(
      "accepted-by-upstream",
    )
    expect(classifyPair(result(false, "direct"), result(false, "proxy"))).toBe(
      "both-enforced",
    )
    expect(classifyPair(result(true, "direct"), result(false, "proxy"))).toBe(
      "proxy-regression",
    )
    const unavailable = result(false, "direct")
    unavailable.status = 503
    expect(classifyPair(unavailable, result(true, "proxy"))).toBe(
      "inconclusive",
    )
  })

  it("extracts endpoint-neutral usage", () => {
    expect(
      extractUsage({ usage: { input_tokens: 10, output_tokens: 2 } }),
    ).toEqual({ input_tokens: 10, output_tokens: 2 })
    expect(extractUsage({ choices: [] })).toBeUndefined()
  })

  it("extracts and verifies provider Copilot usage", () => {
    const body = {
      copilot_usage: {
        token_details: [
          {
            batch_size: 1_000_000,
            cost_per_batch: 500_000_000_000,
            token_count: 9,
            token_type: "input",
          },
          {
            batch_size: 1_000_000,
            cost_per_batch: 3_000_000_000_000,
            token_count: 6,
            token_type: "output",
          },
        ],
        total_nano_aiu: 22_500_000,
      },
    }
    const usage = extractCopilotUsage(body)
    if (!usage) throw new Error("Expected Copilot usage")
    expect(calculateNanoAiu(usage)).toBe(usage.total_nano_aiu)
    expect(nanoAiuToAiu(usage.total_nano_aiu)).toBe(0.0225)
  })

  it("computes account-level credit deltas", () => {
    expect(creditDelta(quotaUsage(100), quotaUsage(125))).toBe(25)
    expect(creditDelta({}, quotaUsage(125))).toBeUndefined()
  })
})
