import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test"

import { state } from "~/lib/state"
import { server } from "~/server"

const originalFetch = globalThis.fetch

beforeEach(() => {
  state.copilotToken = "test-token"
  state.models = {
    object: "list",
    data: [
      {
        id: "text-embedding-test",
        name: "Embedding",
        object: "model",
        vendor: "openai",
        version: "1",
        preview: false,
        model_picker_enabled: true,
        capabilities: {
          family: "embedding",
          limits: { max_inputs: 2 },
          object: "model_capabilities",
          supports: { dimensions: true },
          tokenizer: "test",
          type: "embeddings",
        },
      },
    ],
  }
})

afterEach(() => {
  globalThis.fetch = originalFetch
})

function mockSuccess(capture: (body: Record<string, unknown>) => void): void {
  globalThis.fetch = mock(
    (_input: string | URL | Request, init?: RequestInit) => {
      if (typeof init?.body !== "string") throw new Error("Expected JSON body")
      capture(JSON.parse(init.body) as Record<string, unknown>)
      return Promise.resolve(
        Response.json({
          data: [{ object: "embedding", embedding: [0.1, 0.2], index: 0 }],
          usage: { prompt_tokens: 1, total_tokens: 1 },
        }),
      )
    },
  ) as unknown as typeof fetch
}

async function request(body: unknown): Promise<Response> {
  return await server.request("/v1/embeddings", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  })
}

describe("OpenAI embeddings compatibility", () => {
  it("normalizes scalar string input and standardizes response fields", async () => {
    let upstream: Record<string, unknown> = {}
    mockSuccess((body) => {
      upstream = body
    })

    const response = await request({
      model: "text-embedding-test",
      input: "hello",
    })
    const body = await response.json()

    expect(upstream.input).toEqual(["hello"])
    expect(body).toMatchObject({
      object: "list",
      model: "text-embedding-test",
      data: [{ object: "embedding" }],
    })
  })

  it("preserves batches, dimensions, and float encoding", async () => {
    let upstream: Record<string, unknown> = {}
    mockSuccess((body) => {
      upstream = body
    })

    const response = await request({
      model: "text-embedding-test",
      input: ["hello", "world"],
      dimensions: 2,
      encoding_format: "float",
    })

    expect(response.status).toBe(200)
    expect(upstream).toMatchObject({
      input: ["hello", "world"],
      dimensions: 2,
      encoding_format: "float",
    })
  })

  it("rejects unknown models with a stable model error", async () => {
    const response = await request({ model: "unknown-model", input: "hello" })
    expect(response.status).toBe(400)
    expect(await response.json()).toMatchObject({
      error: { code: "model_not_found", param: "model" },
    })
  })

  const malformedCases: Array<[Record<string, unknown>, string]> = [
    [{ model: "text-embedding-test", input: [] }, "input"],
    [{ model: "text-embedding-test", input: ["a", "b", "c"] }, "input"],
    [
      { model: "text-embedding-test", input: "hello", dimensions: 0 },
      "dimensions",
    ],
    [
      {
        model: "text-embedding-test",
        input: "hello",
        encoding_format: "base64",
      },
      "encoding_format",
    ],
  ]

  it.each(malformedCases)(
    "returns structured errors for malformed input",
    async (payload, param) => {
      const response = await request(payload)
      expect(response.status).toBe(400)
      expect(await response.json()).toMatchObject({
        error: {
          type: "invalid_request_error",
          code: "invalid_value",
          param,
        },
      })
    },
  )

  it("normalizes opaque upstream errors and preserves request IDs", async () => {
    globalThis.fetch = mock(() =>
      Promise.resolve(
        new Response("Bad Request\n", {
          status: 400,
          headers: { "x-copilot-service-request-id": "embed-request-1" },
        }),
      ),
    ) as unknown as typeof fetch

    const response = await request({
      model: "text-embedding-test",
      input: "hello",
    })

    expect(response.status).toBe(400)
    expect(response.headers.get("x-copilot-service-request-id")).toBe(
      "embed-request-1",
    )
    expect(await response.json()).toEqual({
      error: {
        type: "upstream_error",
        code: "embedding_request_failed",
        message: "Bad Request",
        param: null,
      },
    })
  })

  it("propagates the downstream abort signal", async () => {
    let upstreamSignal: AbortSignal | null | undefined
    globalThis.fetch = mock(
      (_input: string | URL | Request, init?: RequestInit) => {
        upstreamSignal = init?.signal
        return Promise.resolve(Response.json({ data: [], usage: {} }))
      },
    ) as unknown as typeof fetch
    const controller = new AbortController()
    controller.abort()

    await server.request("/v1/embeddings", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ model: "text-embedding-test", input: "hello" }),
      signal: controller.signal,
    })

    expect(upstreamSignal?.aborted).toBe(true)
  })
})
