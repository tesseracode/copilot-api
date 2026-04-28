import { describe, it, expect } from "bun:test"

import type { ModelsResponse } from "~/services/copilot/get-models"

import { resolveEndpoint } from "./endpoint-routing"

function mockModels(
  entries: Array<{ id: string; supported_endpoints: Array<string> }>,
): ModelsResponse {
  return {
    object: "list",
    data: entries.map((e) => ({
      id: e.id,
      name: e.id,
      version: "1.0",
      supported_endpoints: e.supported_endpoints,
      object: "model" as const,
      created: 0,
      owned_by: "test",
    })),
  } as unknown as ModelsResponse
}

describe("resolveEndpoint", () => {
  const models = mockModels([
    {
      id: "claude-sonnet-4.6",
      supported_endpoints: ["/v1/messages", "/chat/completions"],
    },
    {
      id: "claude-opus-4.6",
      supported_endpoints: ["/v1/messages"],
    },
    {
      id: "gpt-5.5",
      supported_endpoints: ["/responses", "/chat/completions"],
    },
    {
      id: "gpt-4.1",
      supported_endpoints: ["/chat/completions"],
    },
    {
      id: "gemini-2.5-pro",
      supported_endpoints: ["/chat/completions"],
    },
  ])

  it("routes Claude models to /v1/messages", () => {
    expect(resolveEndpoint("claude-sonnet-4.6", models)).toBe("/v1/messages")
    expect(resolveEndpoint("claude-opus-4.6", models)).toBe("/v1/messages")
  })

  it("routes GPT-5.x to /responses when available", () => {
    expect(resolveEndpoint("gpt-5.5", models)).toBe("/responses")
  })

  it("routes GPT-4.x to /chat/completions", () => {
    expect(resolveEndpoint("gpt-4.1", models)).toBe("/chat/completions")
  })

  it("routes Gemini to /chat/completions", () => {
    expect(resolveEndpoint("gemini-2.5-pro", models)).toBe("/chat/completions")
  })

  it("falls back to /chat/completions for unknown models", () => {
    expect(resolveEndpoint("unknown-model", models)).toBe("/chat/completions")
  })

  it("falls back to /chat/completions when no cached models", () => {
    expect(resolveEndpoint("claude-sonnet-4.6")).toBe("/chat/completions")
    expect(resolveEndpoint("claude-sonnet-4.6", undefined)).toBe(
      "/chat/completions",
    )
  })

  it("prefers /v1/messages over /chat/completions for Claude", () => {
    // claude-sonnet-4.6 has both endpoints — should pick /v1/messages
    expect(resolveEndpoint("claude-sonnet-4.6", models)).toBe("/v1/messages")
  })

  it("prefers /responses over /chat/completions for dual-endpoint models", () => {
    // gpt-5.5 has both /responses and /chat/completions
    expect(resolveEndpoint("gpt-5.5", models)).toBe("/responses")
  })
})
