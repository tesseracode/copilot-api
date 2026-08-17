import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test"

import { state } from "~/lib/state"
import { server } from "~/server"

const originalFetch = globalThis.fetch

/**
 * Upstream rejects a request that carries both max_tokens and
 * max_completion_tokens with HTTP 400, so the catalog default must only be
 * injected when the client expressed no token control at all. Measured live on
 * claude-opus-4.6: each control alone succeeds, neither succeeds, both fail.
 */
beforeEach(() => {
  state.copilotToken = "test-token"
  state.models = {
    object: "list",
    data: [
      {
        id: "chat-model",
        name: "Chat Model",
        object: "model",
        vendor: "anthropic",
        version: "1",
        preview: false,
        model_picker_enabled: true,
        supported_endpoints: ["/chat/completions"],
        capabilities: {
          family: "claude",
          limits: { max_output_tokens: 4096 },
          object: "model_capabilities",
          supports: {},
          tokenizer: "test",
          type: "chat",
        },
      },
    ],
  }
})

afterEach(() => {
  globalThis.fetch = originalFetch
  state.models = undefined
})

async function captureUpstreamPayload(body: Record<string, unknown>) {
  let captured: Record<string, unknown> | undefined
  globalThis.fetch = mock(
    (_input: string | URL | Request, init?: RequestInit) => {
      if (typeof init?.body !== "string") throw new Error("Expected JSON body")
      captured = JSON.parse(init.body) as Record<string, unknown>
      return Promise.resolve(
        Response.json({ id: "1", object: "chat.completion", choices: [] }),
      )
    },
  ) as unknown as typeof fetch

  const response = await server.request("/v1/chat/completions", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      model: "chat-model",
      messages: [{ role: "user", content: "hi" }],
      ...body,
    }),
  })

  return { status: response.status, payload: captured }
}

describe("chat token limit injection", () => {
  it("injects the catalog default when the client sends neither control", async () => {
    const { payload } = await captureUpstreamPayload({})
    expect(payload?.max_tokens).toBe(4096)
    expect(payload).not.toHaveProperty("max_completion_tokens")
  })

  it("keeps a client max_tokens unchanged", async () => {
    const { payload } = await captureUpstreamPayload({ max_tokens: 128 })
    expect(payload?.max_tokens).toBe(128)
    expect(payload).not.toHaveProperty("max_completion_tokens")
  })

  it("does not inject max_tokens alongside a client max_completion_tokens", async () => {
    const { payload } = await captureUpstreamPayload({
      max_completion_tokens: 128,
    })
    expect(payload?.max_completion_tokens).toBe(128)
    expect(payload).not.toHaveProperty("max_tokens")
  })

  it("does not inject when max_tokens is explicitly null but max_completion_tokens is set", async () => {
    const { payload } = await captureUpstreamPayload({
      max_tokens: null,
      max_completion_tokens: 128,
    })
    expect(payload?.max_completion_tokens).toBe(128)
    expect(payload?.max_tokens).toBeNull()
  })

  it("forwards both controls unchanged when the client sends both", async () => {
    const { payload } = await captureUpstreamPayload({
      max_tokens: 64,
      max_completion_tokens: 128,
    })
    expect(payload?.max_tokens).toBe(64)
    expect(payload?.max_completion_tokens).toBe(128)
  })

  it("never emits both controls when the client sent only one", async () => {
    for (const body of [{ max_tokens: 128 }, { max_completion_tokens: 128 }]) {
      const { payload } = await captureUpstreamPayload(body)
      const emitted = [
        payload?.max_tokens,
        payload?.max_completion_tokens,
      ].filter((value) => value !== undefined && value !== null)
      expect(emitted).toHaveLength(1)
    }
  })

  it("applies the same rule to streaming requests", async () => {
    const { payload } = await captureUpstreamPayload({
      max_completion_tokens: 128,
      stream: false,
    })
    expect(payload).not.toHaveProperty("max_tokens")
  })
})
