import { beforeEach, describe, expect, it } from "bun:test"

import type { AnthropicMessagesPayload } from "~/routes/messages/anthropic-types"

import { state } from "~/lib/state"
import { buildNativeBody } from "~/services/copilot/forward-native-messages"

function payload(effort: "auto" | "xhigh"): AnthropicMessagesPayload {
  return {
    model: "claude-sonnet-4-6",
    messages: [{ role: "user", content: "Hello" }],
    max_tokens: 8192,
    output_config: { effort },
  }
}

describe("native effort normalization", () => {
  beforeEach(() => {
    state.models = {
      object: "list",
      data: [
        {
          id: "claude-sonnet-4.6",
          capabilities: {
            family: "claude-sonnet-4.6",
            limits: {},
            object: "model_capabilities",
            supports: {
              reasoning_effort: ["low", "medium", "high", "max"],
            },
            tokenizer: "test",
            type: "chat",
          },
          model_picker_enabled: true,
          name: "Claude Sonnet 4.6",
          object: "model",
          preview: false,
          vendor: "anthropic",
          version: "4.6",
        },
      ],
    }
  })

  it("falls back from xhigh to high for Claude 4.6", () => {
    expect(buildNativeBody(payload("xhigh"), {}).output_config).toEqual({
      effort: "high",
    })
  })

  it("omits literal auto effort", () => {
    const body = buildNativeBody(payload("auto"), {})
    expect(body).not.toHaveProperty("output_config")
    expect(body).not.toHaveProperty("thinking")
  })
})
