import { describe, expect, it, beforeEach } from "bun:test"

import {
  anthropicToCopilotModelId,
  copilotToAnthropicModelId,
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

  // ── -internal suffix resolution ──

  it("resolves to -1m-internal when only that variant exists", () => {
    setCatalog(["claude-opus-4.7", "claude-opus-4.7-1m-internal"])
    expect(anthropicToCopilotModelId("claude-opus-4.7", true)).toBe(
      "claude-opus-4.7-1m-internal",
    )
    expect(anthropicToCopilotModelId("claude-opus-4.7[1m]", false)).toBe(
      "claude-opus-4.7-1m-internal",
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

  it("accepts dot-format Claude IDs with a [1m] suffix", () => {
    setCatalog(["claude-opus-4.7", "claude-opus-4.7-1m-internal"])
    expect(anthropicToCopilotModelId("claude-opus-4.7[1m]", false)).toBe(
      "claude-opus-4.7-1m-internal",
    )
  })

  // ── Effort suffix handling ──

  it("maps -high suffix through dash→dot conversion", () => {
    setCatalog(["claude-opus-4.7", "claude-opus-4.7-high"])
    expect(anthropicToCopilotModelId("claude-opus-4-7-high", false)).toBe(
      "claude-opus-4.7-high",
    )
  })

  it("maps -xhigh suffix through dash→dot conversion", () => {
    setCatalog(["claude-opus-4.7", "claude-opus-4.7-xhigh"])
    expect(anthropicToCopilotModelId("claude-opus-4-7-xhigh", false)).toBe(
      "claude-opus-4.7-xhigh",
    )
  })

  it("falls back to base when effort variant not in catalog", () => {
    setCatalog(["claude-opus-4.7"])
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

  // ── Effort suffix stripping ──
  // Callers like Claude Code's getCanonicalName() don't recognize -high/-xhigh.
  // Effort is a request-time concern; response uses base model identity.

  it("strips -high suffix for clean response model", () => {
    expect(copilotToAnthropicModelId("claude-opus-4.7-high")).toBe(
      "claude-opus-4-7",
    )
  })

  it("strips -xhigh suffix for clean response model", () => {
    expect(copilotToAnthropicModelId("claude-opus-4.7-xhigh")).toBe(
      "claude-opus-4-7",
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

  it("response model table: effort=high variant stripped to base", () => {
    expect(copilotToAnthropicModelId("claude-opus-4.7-high")).toBe(
      "claude-opus-4-7",
    )
  })

  it("response model table: effort=xhigh variant stripped to base", () => {
    expect(copilotToAnthropicModelId("claude-opus-4.7-xhigh")).toBe(
      "claude-opus-4-7",
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
