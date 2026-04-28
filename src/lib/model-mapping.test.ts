import { describe, it, expect, beforeEach } from "bun:test"

import {
  anthropicToCopilotModelId,
  copilotToAnthropicModelId,
} from "./model-mapping"
import { state } from "./state"

describe("anthropicToCopilotModelId", () => {
  beforeEach(() => {
    // Provide a model catalog with -1m variants for suffix tests
    state.models = {
      object: "list",
      data: [
        {
          id: "claude-opus-4.6",
          object: "model",
          created: 0,
          owned_by: "anthropic",
        },
        {
          id: "claude-opus-4.6-1m",
          object: "model",
          created: 0,
          owned_by: "anthropic",
        },
      ],
    } as unknown as typeof state.models
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
    expect(anthropicToCopilotModelId("claude-sonnet-4-5", false)).toBe(
      "claude-sonnet-4.5",
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
    expect(anthropicToCopilotModelId("some-new-model", false)).toBe(
      "some-new-model",
    )
  })

  it("handles haiku models", () => {
    expect(anthropicToCopilotModelId("claude-haiku-4-5", false)).toBe(
      "claude-haiku-4.5",
    )
  })

  // ── -internal suffix resolution ──

  it("resolves to -1m-internal when only -1m-internal exists in catalog", () => {
    state.models = {
      object: "list",
      data: [
        {
          id: "claude-opus-4.7",
          object: "model",
          created: 0,
          owned_by: "anthropic",
        },
        {
          id: "claude-opus-4.7-1m-internal",
          object: "model",
          created: 0,
          owned_by: "anthropic",
        },
      ],
    } as unknown as typeof state.models

    // is1M=true → should find -1m-internal since -1m doesn't exist
    expect(anthropicToCopilotModelId("claude-opus-4.7", true)).toBe(
      "claude-opus-4.7-1m-internal",
    )
  })

  it("resolves [1m] suffix to -1m-internal when that's the only variant", () => {
    state.models = {
      object: "list",
      data: [
        {
          id: "claude-opus-4.7",
          object: "model",
          created: 0,
          owned_by: "anthropic",
        },
        {
          id: "claude-opus-4.7-1m-internal",
          object: "model",
          created: 0,
          owned_by: "anthropic",
        },
      ],
    } as unknown as typeof state.models

    // [1m] suffix → should resolve to -1m-internal
    expect(anthropicToCopilotModelId("claude-opus-4.7[1m]", false)).toBe(
      "claude-opus-4.7-1m-internal",
    )
  })

  it("prefers -1m over -1m-internal when both exist", () => {
    state.models = {
      object: "list",
      data: [
        {
          id: "claude-opus-4.8",
          object: "model",
          created: 0,
          owned_by: "anthropic",
        },
        {
          id: "claude-opus-4.8-1m",
          object: "model",
          created: 0,
          owned_by: "anthropic",
        },
        {
          id: "claude-opus-4.8-1m-internal",
          object: "model",
          created: 0,
          owned_by: "anthropic",
        },
      ],
    } as unknown as typeof state.models

    expect(anthropicToCopilotModelId("claude-opus-4.8", true)).toBe(
      "claude-opus-4.8-1m",
    )
  })
})

describe("copilotToAnthropicModelId", () => {
  it("maps dot format to dash format", () => {
    expect(copilotToAnthropicModelId("claude-opus-4.6")).toBe("claude-opus-4-6")
    expect(copilotToAnthropicModelId("claude-sonnet-4.6")).toBe(
      "claude-sonnet-4-6",
    )
  })

  it("handles -1m suffix", () => {
    expect(copilotToAnthropicModelId("claude-opus-4.6-1m")).toBe(
      "claude-opus-4-6[1m]",
    )
  })

  it("passes through unknown models unchanged", () => {
    expect(copilotToAnthropicModelId("gpt-4o")).toBe("gpt-4o")
  })
})
