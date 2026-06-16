import { describe, expect, it, beforeEach } from "bun:test"

import {
  anthropicToCopilotModelId,
  copilotToAnthropicModelId,
  extractEffortFromModelName,
} from "./model-mapping"
import { state } from "./state"

// Helper to set up model catalog
function setCatalog(ids: Array<string>) {
  state.models = {
    object: "list",
    data: ids.map((id) => ({
      id,
      object: "model",
      created: 0,
      owned_by: "anthropic",
    })),
  } as unknown as typeof state.models
}

describe("anthropicToCopilotModelId", () => {
  beforeEach(() => {
    setCatalog(["claude-opus-4.6", "claude-opus-4.6-1m"])
  })

  it("maps dash format to dot format", () => {
    expect(anthropicToCopilotModelId("claude-opus-4-6", false)).toBe(
      "claude-opus-4.6",
    )
    expect(anthropicToCopilotModelId("claude-sonnet-4-6", false)).toBe(
      "claude-sonnet-4.6",
    )
    expect(anthropicToCopilotModelId("claude-opus-4-5", false)).toBe(
      "claude-opus-4.5",
    )
    expect(anthropicToCopilotModelId("claude-opus-4-7", false)).toBe(
      "claude-opus-4.7",
    )
  })

  it("handles [1m] suffix when model exists in catalog", () => {
    expect(anthropicToCopilotModelId("claude-opus-4-6[1m]", false)).toBe(
      "claude-opus-4.6-1m",
    )
  })

  it("strips [1m] suffix when model not in catalog", () => {
    expect(anthropicToCopilotModelId("claude-sonnet-4-6[1m]", false)).toBe(
      "claude-sonnet-4.6",
    )
  })

  it("passes through unknown models unchanged", () => {
    expect(anthropicToCopilotModelId("gpt-4o", false)).toBe("gpt-4o")
  })

  it("handles haiku models", () => {
    expect(anthropicToCopilotModelId("claude-haiku-4-5", false)).toBe(
      "claude-haiku-4.5",
    )
  })

  // ── -internal suffix resolution (backward compat) ──

  it("resolves to -1m when variant exists in catalog", () => {
    setCatalog(["claude-opus-4.7", "claude-opus-4.7-1m"])
    expect(anthropicToCopilotModelId("claude-opus-4.7", true)).toBe(
      "claude-opus-4.7-1m",
    )
    expect(anthropicToCopilotModelId("claude-opus-4.7[1m]", false)).toBe(
      "claude-opus-4.7-1m",
    )
  })

  it("falls back to base model when no -1m variant exists (1M is default)", () => {
    setCatalog(["claude-opus-4.7"])
    expect(anthropicToCopilotModelId("claude-opus-4.7", true)).toBe(
      "claude-opus-4.7",
    )
    expect(anthropicToCopilotModelId("claude-opus-4.7[1m]", false)).toBe(
      "claude-opus-4.7",
    )
  })

  it("prefers -1m over -1m-internal when both exist", () => {
    setCatalog([
      "claude-opus-4.8",
      "claude-opus-4.8-1m",
      "claude-opus-4.8-1m-internal",
    ])
    expect(anthropicToCopilotModelId("claude-opus-4.8", true)).toBe(
      "claude-opus-4.8-1m",
    )
  })

  // ── Effort suffixes are stripped from model name (backward compat) ──
  // Effort is sent via output_config.effort in the request body

  it("strips effort suffix from model name for backward compat", () => {
    setCatalog(["claude-opus-4.7"])
    // Legacy configs like "claude-opus-4-7-xhigh" get the suffix stripped
    expect(anthropicToCopilotModelId("claude-opus-4-7-xhigh", false)).toBe(
      "claude-opus-4.7",
    )
    expect(anthropicToCopilotModelId("claude-opus-4-7-high", false)).toBe(
      "claude-opus-4.7",
    )
  })
})

describe("copilotToAnthropicModelId", () => {
  it("maps dot format to dash format", () => {
    expect(copilotToAnthropicModelId("claude-opus-4.6")).toBe("claude-opus-4-6")
    expect(copilotToAnthropicModelId("claude-opus-4.7")).toBe("claude-opus-4-7")
  })

  it("handles -1m suffix → [1m]", () => {
    expect(copilotToAnthropicModelId("claude-opus-4.6-1m")).toBe(
      "claude-opus-4-6[1m]",
    )
  })

  it("passes through unknown models unchanged", () => {
    expect(copilotToAnthropicModelId("gpt-4o")).toBe("gpt-4o")
  })

  // ── -internal suffix stripping ──

  it("strips -internal and maps -1m to [1m]", () => {
    expect(copilotToAnthropicModelId("claude-opus-4.7-1m-internal")).toBe(
      "claude-opus-4-7[1m]",
    )
  })

  it("strips -internal from non-1m models", () => {
    expect(copilotToAnthropicModelId("claude-opus-4.7-internal")).toBe(
      "claude-opus-4-7",
    )
  })

  // ── Effort suffix handling removed ──
  // These model IDs no longer exist. The upstream always returns base model
  // in response.model anyway (verified in upstream-model-id-report.md).
  // If they somehow appear, they pass through without special handling.

  it("passes through -high suffix unchanged (variant models no longer exist)", () => {
    expect(copilotToAnthropicModelId("claude-opus-4.7-high")).toBe(
      "claude-opus-4.7-high",
    )
  })

  it("passes through -xhigh suffix unchanged (variant models no longer exist)", () => {
    expect(copilotToAnthropicModelId("claude-opus-4.7-xhigh")).toBe(
      "claude-opus-4.7-xhigh",
    )
  })

  // ── Combined suffix scenarios ──

  it("handles -1m + -internal correctly (strip order matters)", () => {
    // This was the bug: endsWith("-1m") failed because it ended with "-1m-internal"
    // Must strip -internal FIRST, then check -1m
    const result = copilotToAnthropicModelId("claude-opus-4.7-1m-internal")
    expect(result).toBe("claude-opus-4-7[1m]")
    // Verify it doesn't produce "claude-opus-4-7-1m" (is1M=false bug)
    expect(result).not.toBe("claude-opus-4-7-1m")
    expect(result).not.toContain("-1m-")
  })

  // ── Full effort routing table ──
  // These test the reverse mapping that clients see in response.model

  it("response model table: base model", () => {
    expect(copilotToAnthropicModelId("claude-opus-4.7")).toBe("claude-opus-4-7")
  })

  it("response model table: effort variants pass through (upstream strips them anyway)", () => {
    // The upstream API returns base model in response.model regardless.
    // These IDs should never appear in practice, but if they do, they pass through.
    expect(copilotToAnthropicModelId("claude-opus-4.7-high")).toBe(
      "claude-opus-4.7-high",
    )
    expect(copilotToAnthropicModelId("claude-opus-4.7-xhigh")).toBe(
      "claude-opus-4.7-xhigh",
    )
  })

  it("response model table: 1m-internal variant", () => {
    expect(copilotToAnthropicModelId("claude-opus-4.7-1m-internal")).toBe(
      "claude-opus-4-7[1m]",
    )
  })

  it("response model table: 4.6 base", () => {
    expect(copilotToAnthropicModelId("claude-opus-4.6")).toBe("claude-opus-4-6")
  })

  it("response model table: 4.6-1m", () => {
    expect(copilotToAnthropicModelId("claude-opus-4.6-1m")).toBe(
      "claude-opus-4-6[1m]",
    )
  })

  // ── Non-Claude models should pass through ──

  it("GPT models pass through unchanged", () => {
    expect(copilotToAnthropicModelId("gpt-5.5")).toBe("gpt-5.5")
    expect(copilotToAnthropicModelId("gpt-5.5-2026-04-23")).toBe(
      "gpt-5.5-2026-04-23",
    )
  })

  it("Gemini models pass through unchanged", () => {
    expect(copilotToAnthropicModelId("gemini-2.5-pro")).toBe("gemini-2.5-pro")
  })
})

// ── -1m dash suffix stripping (backward compat) ──

describe("anthropicToCopilotModelId -1m dash suffix", () => {
  beforeEach(() => {
    setCatalog(["claude-opus-4.6", "claude-opus-4.7"])
  })

  it("strips -1m suffix and resolves to base model (no -1m variant in catalog)", () => {
    expect(anthropicToCopilotModelId("claude-opus-4.6-1m", false)).toBe(
      "claude-opus-4.6",
    )
  })

  it("strips -1m suffix from dash-format model names", () => {
    expect(anthropicToCopilotModelId("claude-opus-4-7-1m", false)).toBe(
      "claude-opus-4.7",
    )
  })

  it("resolves to -1m variant when it exists in catalog", () => {
    setCatalog(["claude-opus-4.6", "claude-opus-4.6-1m"])
    expect(anthropicToCopilotModelId("claude-opus-4.6-1m", false)).toBe(
      "claude-opus-4.6-1m",
    )
  })

  it("treats -1m suffix the same as [1m] suffix", () => {
    setCatalog(["claude-opus-4.6"])
    const dash = anthropicToCopilotModelId("claude-opus-4-6-1m", false)
    const bracket = anthropicToCopilotModelId("claude-opus-4-6[1m]", false)
    expect(dash).toBe(bracket)
  })
})

// ── extractEffortFromModelName ──

describe("extractEffortFromModelName", () => {
  it("extracts -xhigh suffix", () => {
    const result = extractEffortFromModelName("claude-opus-4-7-xhigh")
    expect(result).toEqual({ base: "claude-opus-4-7", effort: "xhigh" })
  })

  it("extracts -high suffix", () => {
    const result = extractEffortFromModelName("claude-opus-4-7-high")
    expect(result).toEqual({ base: "claude-opus-4-7", effort: "high" })
  })

  it("extracts -max suffix", () => {
    const result = extractEffortFromModelName("claude-opus-4-6-max")
    expect(result).toEqual({ base: "claude-opus-4-6", effort: "max" })
  })

  it("extracts -low suffix", () => {
    const result = extractEffortFromModelName("claude-opus-4-6-low")
    expect(result).toEqual({ base: "claude-opus-4-6", effort: "low" })
  })

  it("returns undefined effort for model names without effort suffix", () => {
    const result = extractEffortFromModelName("claude-opus-4.7")
    expect(result).toEqual({ base: "claude-opus-4.7", effort: undefined })
  })

  it("does not confuse -1m with an effort suffix", () => {
    const result = extractEffortFromModelName("claude-opus-4.6-1m")
    expect(result).toEqual({ base: "claude-opus-4.6-1m", effort: undefined })
  })
})
