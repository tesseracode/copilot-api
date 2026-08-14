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

/**
 * Copilot Responses is stateless: upstream rejects `store:true` and cannot
 * honour `previous_response_id`. The proxy therefore forwards these fields
 * verbatim rather than coercing them, so a client that asks for storage gets a
 * loud upstream rejection instead of a silently truncated conversation.
 */
function captureUpstream() {
  const captured: { body?: Record<string, unknown> } = {}
  globalThis.fetch = mock(
    (_input: string | URL | Request, init?: RequestInit) => {
      if (typeof init?.body !== "string") throw new Error("Expected JSON body")
      captured.body = JSON.parse(init.body) as Record<string, unknown>
      return Promise.resolve(
        Response.json({ id: "resp_1", object: "response" }),
      )
    },
  ) as unknown as typeof fetch
  return captured
}

async function post(body: Record<string, unknown>) {
  return server.request("/v1/responses", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  })
}

describe("stateless Responses state contract", () => {
  it("never defaults store when the client omits it", async () => {
    const captured = captureUpstream()
    await post({ model: "gpt-responses", input: "hello" })
    expect(captured.body).not.toHaveProperty("store")
  })

  it("forwards store:false unchanged", async () => {
    const captured = captureUpstream()
    await post({ model: "gpt-responses", input: "hello", store: false })
    expect(captured.body?.store).toBe(false)
  })

  it("forwards store:true unchanged instead of coercing it", async () => {
    const captured = captureUpstream()
    await post({ model: "gpt-responses", input: "hello", store: true })
    expect(captured.body?.store).toBe(true)
  })

  it("surfaces the upstream store rejection verbatim", async () => {
    const upstreamError = {
      error: {
        code: "unsupported_value",
        message: "store must be the boolean false when provided",
        type: "invalid_request_error",
      },
    }
    globalThis.fetch = mock(() =>
      Promise.resolve(Response.json(upstreamError, { status: 400 })),
    ) as unknown as typeof fetch

    const response = await post({
      model: "gpt-responses",
      input: "hello",
      store: true,
    })

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual(upstreamError)
  })

  it("forwards previous_response_id unchanged without implying continuation", async () => {
    const captured = captureUpstream()
    await post({
      model: "gpt-responses",
      input: "hello",
      previous_response_id: "resp_previous",
      store: false,
    })
    expect(captured.body?.previous_response_id).toBe("resp_previous")
  })

  it("forwards store and previous_response_id unchanged when streaming", async () => {
    let captured: Record<string, unknown> | undefined
    globalThis.fetch = mock(
      (_input: string | URL | Request, init?: RequestInit) => {
        if (typeof init?.body !== "string")
          throw new Error("Expected JSON body")
        captured = JSON.parse(init.body) as Record<string, unknown>
        return Promise.resolve(
          new Response('data: {"type":"response.created"}\n\n', {
            headers: { "content-type": "text/event-stream" },
          }),
        )
      },
    ) as unknown as typeof fetch

    const response = await post({
      model: "gpt-responses",
      input: "hello",
      stream: true,
      store: true,
      previous_response_id: "resp_previous",
    })

    expect(response.status).toBe(200)
    expect(captured?.store).toBe(true)
    expect(captured?.previous_response_id).toBe("resp_previous")
  })

  it("fabricates no response identifier and stores no state", async () => {
    globalThis.fetch = mock(() =>
      Promise.resolve(
        Response.json({ id: "resp_upstream", object: "response" }),
      ),
    ) as unknown as typeof fetch

    const first = await post({ model: "gpt-responses", input: "one" })
    const second = await post({ model: "gpt-responses", input: "two" })

    expect(await first.json()).toMatchObject({ id: "resp_upstream" })
    expect(await second.json()).toMatchObject({ id: "resp_upstream" })
  })
})
