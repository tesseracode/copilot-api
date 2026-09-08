import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test"

import { state } from "~/lib/state"
import { server } from "~/server"

const originalFetch = globalThis.fetch

/**
 * Not every catalog entry carries capabilities.limits. Live examples are
 * `gpt-41-copilot` (type: completion) and `text-embedding-3-small-inference`,
 * both of which also omit supported_endpoints. Reading through the absent
 * object used to throw and surface as HTTP 500.
 */
const LIMITLESS_CHAT_MODEL = {
  id: "gpt-41-copilot",
  name: "GPT 4.1 Copilot",
  object: "model",
  vendor: "Azure OpenAI",
  version: "1",
  preview: false,
  model_picker_enabled: false,
  capabilities: {
    family: "gpt-4.1",
    object: "model_capabilities",
    supports: { streaming: true },
    tokenizer: "o200k_base",
    type: "completion",
  },
}

const LIMITLESS_EMBEDDING_MODEL = {
  id: "text-embedding-3-small-inference",
  name: "Embedding V3 small (Inference)",
  object: "model",
  vendor: "Azure OpenAI",
  version: "1",
  preview: false,
  model_picker_enabled: false,
  capabilities: {
    family: "text-embedding-3-small",
    object: "model_capabilities",
    supports: { dimensions: true },
    tokenizer: "cl100k_base",
    type: "embeddings",
  },
}

beforeEach(() => {
  state.copilotToken = "test-token"
  state.models = {
    object: "list",
    data: [LIMITLESS_CHAT_MODEL, LIMITLESS_EMBEDDING_MODEL],
  } as unknown as typeof state.models
})

afterEach(() => {
  globalThis.fetch = originalFetch
  state.models = undefined
})

describe("catalog entries without capabilities.limits", () => {
  it("does not crash the chat path", async () => {
    let upstreamBody: Record<string, unknown> | undefined
    globalThis.fetch = mock(
      (_input: string | URL | Request, init?: RequestInit) => {
        if (typeof init?.body === "string") {
          upstreamBody = JSON.parse(init.body) as Record<string, unknown>
        }
        return Promise.resolve(
          Response.json({ id: "1", object: "chat.completion", choices: [] }),
        )
      },
    ) as unknown as typeof fetch

    const response = await server.request("/v1/chat/completions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        model: "gpt-41-copilot",
        messages: [{ role: "user", content: "hi" }],
      }),
    })

    expect(response.status).toBe(200)
    // No catalog ceiling exists, so none is injected.
    expect(upstreamBody?.max_tokens).toBeUndefined()
  })

  it("still honours a client max_tokens for such a model", async () => {
    let upstreamBody: Record<string, unknown> | undefined
    globalThis.fetch = mock(
      (_input: string | URL | Request, init?: RequestInit) => {
        if (typeof init?.body === "string") {
          upstreamBody = JSON.parse(init.body) as Record<string, unknown>
        }
        return Promise.resolve(
          Response.json({ id: "1", object: "chat.completion", choices: [] }),
        )
      },
    ) as unknown as typeof fetch

    const response = await server.request("/v1/chat/completions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        model: "gpt-41-copilot",
        messages: [{ role: "user", content: "hi" }],
        max_tokens: 64,
      }),
    })

    expect(response.status).toBe(200)
    expect(upstreamBody?.max_tokens).toBe(64)
  })

  it("does not crash the embeddings path", async () => {
    globalThis.fetch = mock(() =>
      Promise.resolve(Response.json({ object: "list", data: [], model: "x" })),
    ) as unknown as typeof fetch

    const response = await server.request("/v1/embeddings", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        model: "text-embedding-3-small-inference",
        input: ["a", "b"],
      }),
    })

    expect(response.status).toBe(200)
  })

  it("lists such models without crashing", async () => {
    const response = await server.request("/v1/models")
    expect(response.status).toBe(200)
    const body = (await response.json()) as { data: Array<{ id: string }> }
    expect(body.data.map((m) => m.id)).toContain("gpt-41-copilot")
  })
})
