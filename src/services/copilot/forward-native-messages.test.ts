import { beforeEach, describe, expect, it } from "bun:test"

import type { AnthropicMessagesPayload } from "~/routes/messages/anthropic-types"

import { state } from "~/lib/state"

import { buildNativeBody } from "./forward-native-messages"

function basePayload(
  overrides: Partial<AnthropicMessagesPayload> = {},
): AnthropicMessagesPayload {
  return {
    model: "claude-sonnet-4-6",
    messages: [{ role: "user", content: "Hello" }],
    max_tokens: 8192,
    ...overrides,
  }
}

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

describe("buildNativeBody", () => {
  beforeEach(() => {
    state.is1MContext = false
    setCatalog([
      "claude-sonnet-4.6",
      "claude-opus-4.7",
      "claude-opus-4.7-1m-internal",
    ])
  })

  describe("stop_sequences sanitization", () => {
    it("strips whitespace-only stop sequences", () => {
      const body = buildNativeBody(basePayload({ stop_sequences: ["\n"] }), {})
      expect(body.stop_sequences).toBeUndefined()
    })

    it("keeps valid stop sequences", () => {
      const body = buildNativeBody(
        basePayload({ stop_sequences: ["END", "STOP"] }),
        {},
      )
      expect(body.stop_sequences).toEqual(["END", "STOP"])
    })

    it("filters mixed stop sequences", () => {
      const body = buildNativeBody(
        basePayload({ stop_sequences: ["\n", "END", " \t ", "STOP"] }),
        {},
      )
      expect(body.stop_sequences).toEqual(["END", "STOP"])
    })

    it("removes field when all entries are whitespace", () => {
      const body = buildNativeBody(
        basePayload({ stop_sequences: ["\n", " ", "\t"] }),
        {},
      )
      expect(body).not.toHaveProperty("stop_sequences")
    })
  })

  describe("thinking normalization", () => {
    it("downgrades adaptive to enabled", () => {
      const body = buildNativeBody(
        basePayload({ thinking: { type: "adaptive" } }),
        {},
      )
      expect(body.thinking).toEqual({
        type: "enabled",
        budget_tokens: Math.max(1024, 8192 - 1),
      })
    })

    it("preserves enabled thinking with budget", () => {
      const body = buildNativeBody(
        basePayload({
          thinking: { type: "enabled", budget_tokens: 4096 },
        }),
        {},
      )
      expect(body.thinking).toEqual({
        type: "enabled",
        budget_tokens: 4096,
      })
    })

    it("enforces minimum budget of 1024", () => {
      const body = buildNativeBody(
        basePayload({
          max_tokens: 1500,
          thinking: { type: "adaptive" },
        }),
        {},
      )
      const thinking = body.thinking as { budget_tokens: number }
      expect(thinking.budget_tokens).toBeGreaterThanOrEqual(1024)
    })

    it("passes disabled thinking through", () => {
      const body = buildNativeBody(
        basePayload({ thinking: { type: "disabled" } }),
        {},
      )
      expect(body.thinking).toEqual({ type: "disabled" })
    })

    it("omits thinking when not specified", () => {
      const body = buildNativeBody(basePayload(), {})
      expect(body.thinking).toBeUndefined()
    })
  })

  describe("effort mapping", () => {
    it("maps low effort to disabled thinking", () => {
      const body = buildNativeBody(
        basePayload({ output_config: { effort: "low" } }),
        {},
      )
      expect(body.thinking).toEqual({ type: "disabled" })
    })

    it("maps medium effort to ~50% budget", () => {
      const body = buildNativeBody(
        basePayload({ output_config: { effort: "medium" } }),
        {},
      )
      const thinking = body.thinking as { type: string; budget_tokens: number }
      expect(thinking.type).toBe("enabled")
      expect(thinking.budget_tokens).toBe(Math.floor(8192 * 0.5))
    })

    it("maps high effort to ~80% budget", () => {
      const body = buildNativeBody(
        basePayload({ output_config: { effort: "high" } }),
        {},
      )
      const thinking = body.thinking as { type: string; budget_tokens: number }
      expect(thinking.type).toBe("enabled")
      expect(thinking.budget_tokens).toBe(Math.floor(8192 * 0.8))
    })

    it("maps max effort to max budget", () => {
      const body = buildNativeBody(
        basePayload({ output_config: { effort: "max" } }),
        {},
      )
      const thinking = body.thinking as { type: string; budget_tokens: number }
      expect(thinking.type).toBe("enabled")
      expect(thinking.budget_tokens).toBe(8192 - 1)
    })

    it("max effort overrides explicit budget", () => {
      const body = buildNativeBody(
        basePayload({
          thinking: { type: "enabled", budget_tokens: 2048 },
          output_config: { effort: "max" },
        }),
        {},
      )
      const thinking = body.thinking as { type: string; budget_tokens: number }
      expect(thinking.budget_tokens).toBe(8192 - 1)
    })
  })

  describe("field allowlist", () => {
    it("does not forward output_config", () => {
      const body = buildNativeBody(
        basePayload({ output_config: { effort: "high" } }),
        {},
      )
      expect(body).not.toHaveProperty("output_config")
    })

    it("does not forward unknown fields", () => {
      const payload = {
        ...basePayload(),
        anthropic_internal: { foo: "bar" },
      } as AnthropicMessagesPayload
      const body = buildNativeBody(payload, {})
      expect(body).not.toHaveProperty("anthropic_internal")
    })

    it("forwards allowed optional fields", () => {
      const body = buildNativeBody(
        basePayload({
          system: "You are helpful",
          temperature: 0.7,
          top_p: 0.9,
          top_k: 40,
        }),
        {},
      )
      expect(body.system).toBe("You are helpful")
      expect(body.temperature).toBe(0.7)
      expect(body.top_p).toBe(0.9)
      expect(body.top_k).toBe(40)
    })
  })

  describe("overrides", () => {
    it("applies overrides last", () => {
      const body = buildNativeBody(basePayload(), { stream: true })
      expect(body.stream).toBe(true)
    })
  })

  describe("1M model selection", () => {
    it("keeps the base model when 1M context is not requested", () => {
      const body = buildNativeBody(
        basePayload({ model: "claude-opus-4.7" }),
        {},
        false,
      )
      expect(body.model).toBe("claude-opus-4.7")
    })

    it("upgrades to the 1M variant when 1M context is requested", () => {
      const body = buildNativeBody(
        basePayload({ model: "claude-opus-4.7" }),
        {},
        true,
      )
      expect(body.model).toBe("claude-opus-4.7-1m-internal")
    })

    it("accepts mixed dot-format models with a [1m] suffix", () => {
      const body = buildNativeBody(
        basePayload({ model: "claude-opus-4.7[1m]" }),
        {},
        false,
      )
      expect(body.model).toBe("claude-opus-4.7-1m-internal")
    })
  })
})
