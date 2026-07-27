/**
 * Error envelope coverage for /v1/messages.
 *
 * The route speaks the Anthropic contract, whose errors carry a top-level
 * `type: "error"` alongside the nested error object. Before this was fixed the
 * endpoint returned the correct shape only when it was passing an upstream
 * rejection through, and an OpenAI-shaped one whenever the proxy raised the
 * error itself.
 *
 * The upstream envelopes asserted here were captured live from
 * api.githubcopilot.com: /v1/messages returns a top-level type and a
 * request_id, while /chat/completions returns {"error":{"message","code"}} with
 * no top-level type. They are genuinely different contracts, which is why
 * /chat/completions keeps forwardError.
 */
import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test"

import type { ModelsResponse } from "~/services/copilot/get-models"

import { state } from "~/lib/state"
import { server } from "~/server"

const originalFetch = globalThis.fetch
const originalModels = state.models
const originalToken = state.copilotToken

const catalog = {
  object: "list",
  data: [
    {
      id: "claude-sonnet-5",
      name: "claude-sonnet-5",
      object: "model",
      vendor: "anthropic",
      version: "1",
      preview: false,
      model_picker_enabled: true,
      supported_endpoints: ["/v1/messages"],
      capabilities: {
        family: "claude-sonnet-5",
        limits: { max_output_tokens: 64000 },
        object: "model_capabilities",
        supports: { tool_calls: true },
        tokenizer: "o200k_base",
        type: "chat",
      },
    },
    {
      id: "gpt-5.5",
      name: "gpt-5.5",
      object: "model",
      vendor: "openai",
      version: "1",
      preview: false,
      model_picker_enabled: true,
      supported_endpoints: ["/responses"],
      capabilities: {
        family: "gpt-5.5",
        limits: { max_output_tokens: 64000 },
        object: "model_capabilities",
        supports: { tool_calls: true },
        tokenizer: "o200k_base",
        type: "chat",
      },
    },
  ],
} as unknown as ModelsResponse

function mockFetchReturning(response: () => Response) {
  globalThis.fetch = mock(() =>
    Promise.resolve(response()),
  ) as unknown as typeof fetch
}

function post(body: string) {
  return server.request("/v1/messages", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body,
  })
}

function validBody(model = "claude-sonnet-5") {
  return JSON.stringify({
    model,
    max_tokens: 64,
    messages: [{ role: "user", content: "hi" }],
  })
}

beforeEach(() => {
  state.copilotToken = "test-token"
  state.models = catalog
})

afterEach(() => {
  globalThis.fetch = originalFetch
  state.models = originalModels
  state.copilotToken = originalToken
})

describe("/v1/messages error envelope", () => {
  it("forwards an upstream Anthropic envelope unchanged, keeping request_id", async () => {
    mockFetchReturning(
      () =>
        new Response(
          JSON.stringify({
            type: "error",
            error: {
              type: "invalid_request_error",
              message: "max_tokens: must be greater than or equal to 0",
            },
            request_id: "req_upstream_1",
          }),
          { status: 400, headers: { "content-type": "application/json" } },
        ),
    )

    const response = await post(validBody())

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({
      type: "error",
      error: {
        type: "invalid_request_error",
        message: "max_tokens: must be greater than or equal to 0",
      },
      request_id: "req_upstream_1",
    })
  })

  it("wraps a local badRequest in the Anthropic envelope", async () => {
    let upstreamCalls = 0
    globalThis.fetch = mock(() => {
      upstreamCalls += 1
      return Promise.resolve(Response.json({}))
    }) as unknown as typeof fetch

    const response = await post(
      JSON.stringify({
        model: "gpt-5.5",
        max_tokens: 64,
        messages: [
          {
            role: "user",
            content: [{ type: "tool_result", tool_use_id: "", content: "x" }],
          },
        ],
      }),
    )

    expect(response.status).toBe(400)
    expect(upstreamCalls).toBe(0)
    expect(await response.json()).toMatchObject({
      type: "error",
      error: { type: "invalid_request_error" },
    })
  })

  it("wraps a local throw in the Anthropic envelope", async () => {
    mockFetchReturning(() => Response.json({}))

    const response = await post("{not json")

    expect(response.status).toBe(500)
    const body = (await response.json()) as {
      type: string
      error: { type: string; message: string }
    }
    expect(body.type).toBe("error")
    expect(body.error.type).toBe("api_error")
    expect(body.error.message).toBeString()
  })

  it("derives the error type from HTTP status when upstream sends non-JSON", async () => {
    mockFetchReturning(
      () =>
        new Response("Unauthorized", {
          status: 401,
          headers: { "content-type": "text/plain" },
        }),
    )

    const response = await post(validBody())

    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({
      type: "error",
      error: { type: "authentication_error", message: "Unauthorized" },
    })
  })

  it("maps a non-JSON 429 to rate_limit_error", async () => {
    mockFetchReturning(
      () =>
        new Response("slow down", {
          status: 429,
          headers: { "content-type": "text/plain" },
        }),
    )

    const response = await post(validBody())

    expect(response.status).toBe(429)
    expect(await response.json()).toMatchObject({
      type: "error",
      error: { type: "rate_limit_error" },
    })
  })

  it("promotes an OpenAI-shaped upstream error into the Anthropic envelope", async () => {
    mockFetchReturning(
      () =>
        new Response(
          JSON.stringify({
            error: { message: "bad things", code: "invalid_request_body" },
          }),
          { status: 400, headers: { "content-type": "application/json" } },
        ),
    )

    const response = await post(validBody())

    expect(response.status).toBe(400)
    // No top-level type upstream, so one is added and the type derived from
    // the status rather than invented.
    expect(await response.json()).toEqual({
      type: "error",
      error: { type: "invalid_request_error", message: "bad things" },
    })
  })
})

describe("/v1/chat/completions keeps the OpenAI envelope", () => {
  it("does not gain a top-level type", async () => {
    mockFetchReturning(
      () =>
        new Response(
          JSON.stringify({
            error: { message: "bad things", code: "invalid_request_body" },
          }),
          { status: 400, headers: { "content-type": "application/json" } },
        ),
    )

    const response = await server.request("/v1/chat/completions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        model: "gpt-5.5",
        max_tokens: 64,
        messages: [{ role: "user", content: "hi" }],
      }),
    })

    expect(response.status).toBe(400)
    const body = (await response.json()) as Record<string, unknown>
    expect(body).not.toHaveProperty("type")
    expect(body.error).toMatchObject({ message: "bad things" })
  })
})
