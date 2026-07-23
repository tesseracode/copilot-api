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
        id: "gpt-responses",
        name: "GPT Responses",
        object: "model",
        vendor: "openai",
        version: "1",
        preview: false,
        model_picker_enabled: true,
        supported_endpoints: ["/responses"],
        capabilities: {
          family: "gpt",
          limits: {},
          object: "model_capabilities",
          supports: {},
          tokenizer: "test",
          type: "chat",
        },
      },
      {
        id: "legacy-chat",
        name: "Legacy",
        object: "model",
        vendor: "openai",
        version: "1",
        preview: false,
        model_picker_enabled: true,
        supported_endpoints: ["/chat/completions"],
        capabilities: {
          family: "legacy",
          limits: {},
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
})

describe("native Responses route", () => {
  it("matches other private proxy routes without inbound authentication", async () => {
    globalThis.fetch = mock(() =>
      Promise.resolve(Response.json({ id: "resp_1", object: "response" })),
    ) as unknown as typeof fetch

    const response = await server.request("/v1/responses", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ model: "gpt-responses", input: "hello" }),
    })
    expect(response.status).toBe(200)
  })

  it("preserves arbitrary request and response fields", async () => {
    let upstreamBody: unknown
    globalThis.fetch = mock(
      (_input: string | URL | Request, init?: RequestInit) => {
        if (typeof init?.body !== "string")
          throw new Error("Expected JSON body")
        upstreamBody = JSON.parse(init.body)
        return Promise.resolve(
          Response.json({
            id: "resp_1",
            object: "response",
            output: [{ type: "reasoning", id: "rs_1", summary: [] }],
            copilot_usage: { token_details: [], total_nano_aiu: 10 },
            custom_field: true,
          }),
        )
      },
    ) as unknown as typeof fetch

    const body = {
      model: "gpt-responses",
      input: "hello",
      include: ["reasoning.encrypted_content"],
      metadata: { harness: "test" },
      stream: false,
    }
    const response = await server.request("/v1/responses", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: "Bearer test",
      },
      body: JSON.stringify(body),
    })

    expect(response.status).toBe(200)
    expect(upstreamBody).toEqual(body)
    expect(await response.json()).toMatchObject({
      custom_field: true,
      copilot_usage: { total_nano_aiu: 10 },
    })
  })

  it("preserves raw SSE bytes", async () => {
    const sse =
      'event: response.created\ndata: {"type":"response.created"}\n\ndata: [DONE]\n\n'
    globalThis.fetch = mock(() =>
      Promise.resolve(
        new Response(sse, {
          headers: { "content-type": "text/event-stream" },
        }),
      ),
    ) as unknown as typeof fetch

    const response = await server.request("/responses", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: "Bearer test",
      },
      body: JSON.stringify({
        model: "gpt-responses",
        input: "hello",
        stream: true,
      }),
    })

    expect(response.headers.get("content-type")).toBe("text/event-stream")
    expect(await response.text()).toBe(sse)
  })

  it("rejects models without Responses support locally", async () => {
    let calls = 0
    globalThis.fetch = mock(() => {
      calls += 1
      return Promise.resolve(Response.json({}))
    }) as unknown as typeof fetch

    const response = await server.request("/v1/responses", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: "Bearer test",
      },
      body: JSON.stringify({ model: "legacy-chat", input: "hello" }),
    })

    expect(response.status).toBe(400)
    expect(calls).toBe(0)
  })

  it("forwards upstream error status and request IDs", async () => {
    globalThis.fetch = mock(() =>
      Promise.resolve(
        new Response("bad request", {
          status: 422,
          headers: {
            "content-type": "text/plain",
            "x-copilot-service-request-id": "request-1",
          },
        }),
      ),
    ) as unknown as typeof fetch

    const response = await server.request("/v1/responses", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: "Bearer test",
      },
      body: JSON.stringify({ model: "gpt-responses", input: "hello" }),
    })

    expect(response.status).toBe(422)
    expect(response.headers.get("x-copilot-service-request-id")).toBe(
      "request-1",
    )
    expect(await response.text()).toBe("bad request")
  })
})
