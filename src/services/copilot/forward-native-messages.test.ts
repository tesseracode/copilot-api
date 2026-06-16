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

function setCatalog(
  ids: Array<string>,
  capabilities?: Record<string, { reasoning_effort?: Array<string> }>,
) {
  state.models = {
    object: "list",
    data: ids.map((id) => ({
      id,
      object: "model",
      created: 0,
      owned_by: "anthropic",
      ...(capabilities?.[id] ?
        {
          capabilities: {
            supports: {
              reasoning_effort: capabilities[id].reasoning_effort,
            },
          },
        }
      : {}),
    })),
  } as unknown as typeof state.models
}

describe("buildNativeBody", () => {
  beforeEach(() => {
    state.is1MContext = false
    setCatalog(["claude-sonnet-4.6", "claude-opus-4.7"], {
      "claude-sonnet-4.6": {
        reasoning_effort: ["low", "medium", "high", "max"],
      },
      "claude-opus-4.7": {
        reasoning_effort: ["low", "medium", "high", "xhigh", "max"],
      },
    })
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
    it("forwards effort via output_config for models with reasoning_effort capability", () => {
      const body = buildNativeBody(
        basePayload({ output_config: { effort: "max" } }),
        {},
      )
      expect(body.output_config).toEqual({ effort: "max" })
    })

    it("forwards effort=xhigh for models that support it", () => {
      const body = buildNativeBody(
        basePayload({
          model: "claude-opus-4-7",
          output_config: { effort: "xhigh" },
        }),
        {},
      )
      expect(body.output_config).toEqual({ effort: "xhigh" })
    })

    it("forwards effort=high via output_config", () => {
      const body = buildNativeBody(
        basePayload({ output_config: { effort: "high" } }),
        {},
      )
      expect(body.output_config).toEqual({ effort: "high" })
    })

    it("maps low effort to disabled thinking when effort is not handled by output_config", () => {
      // Model without reasoning_effort capability
      setCatalog(["claude-sonnet-4.6", "claude-opus-4.7"])
      const body = buildNativeBody(
        basePayload({ output_config: { effort: "low" } }),
        {},
      )
      expect(body.thinking).toEqual({ type: "disabled" })
    })

    it("maps effort to thinking budget for models without reasoning_effort capability", () => {
      // Model without reasoning_effort capability (older model)
      setCatalog(["claude-sonnet-4.6", "claude-opus-4.7"])
      const body = buildNativeBody(
        basePayload({ output_config: { effort: "medium" } }),
        {},
      )
      const thinking = body.thinking as { type: string; budget_tokens: number }
      expect(thinking.type).toBe("enabled")
      expect(thinking.budget_tokens).toBe(Math.floor(8192 * 0.5))
    })

    it("does not override explicit thinking when effort is handled via output_config", () => {
      const body = buildNativeBody(
        basePayload({
          thinking: { type: "enabled", budget_tokens: 2048 },
          output_config: { effort: "max" },
        }),
        {},
      )
      // Effort is handled by output_config, thinking is normalized independently
      expect(body.output_config).toEqual({ effort: "max" })
      const thinking = body.thinking as { type: string; budget_tokens: number }
      expect(thinking.type).toBe("enabled")
      expect(thinking.budget_tokens).toBe(2048)
    })

    it("extracts effort from legacy model-name suffix (backward compat)", () => {
      const body = buildNativeBody(
        basePayload({ model: "claude-opus-4-7-xhigh" }),
        {},
      )
      expect(body.model).toBe("claude-opus-4.7")
      expect(body.output_config).toEqual({ effort: "xhigh" })
    })

    it("extracts -high effort from model name", () => {
      const body = buildNativeBody(
        basePayload({ model: "claude-sonnet-4-6-high" }),
        {},
      )
      expect(body.model).toBe("claude-sonnet-4.6")
      expect(body.output_config).toEqual({ effort: "high" })
    })

    it("output_config.effort takes priority over model-name suffix", () => {
      const body = buildNativeBody(
        basePayload({
          model: "claude-opus-4-7-high",
          output_config: { effort: "max" },
        }),
        {},
      )
      expect(body.model).toBe("claude-opus-4.7")
      expect(body.output_config).toEqual({ effort: "max" })
    })
  })

  describe("field allowlist", () => {
    it("forwards output_config.effort for models with reasoning_effort capability", () => {
      const body = buildNativeBody(
        basePayload({ output_config: { effort: "high" } }),
        {},
      )
      expect(body.output_config).toEqual({ effort: "high" })
    })

    it("does not forward output_config for models without reasoning_effort capability", () => {
      setCatalog(["claude-sonnet-4.6", "claude-opus-4.7"])
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

    it("falls back to base model when no -1m variant exists (1M is now default)", () => {
      const body = buildNativeBody(
        basePayload({ model: "claude-opus-4.7" }),
        {},
        true,
      )
      expect(body.model).toBe("claude-opus-4.7")
    })

    it("strips [1m] suffix and resolves to base model (1M is now default)", () => {
      const body = buildNativeBody(
        basePayload({ model: "claude-opus-4.7[1m]" }),
        {},
        false,
      )
      expect(body.model).toBe("claude-opus-4.7")
    })
  })
})
