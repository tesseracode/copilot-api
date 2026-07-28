/**
 * Client-visible behaviour of the streaming handlers when a stream ends early.
 *
 * NOTE ON WHAT THESE DO AND DO NOT PROVE. By the time a stream fails, the
 * response headers are already sent, so a swallowed abort and a rethrown error
 * look identical from outside: HTTP 200, a partial body, and a clean EOF. A
 * mutation forcing isClientAbort to return false leaves every test in this file
 * passing. So these pin the *client-visible* contract only; the swallow-versus-
 * rethrow decision is pinned directly in tests/streaming-helpers.test.ts.
 *
 * They are still worth having: they exercise all five streaming paths across
 * both handlers end to end, which is what made the consolidation of five
 * duplicated catch blocks into src/lib/streaming.ts verifiable as
 * behaviour-preserving.
 */
import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test"

import type { ModelsResponse } from "~/services/copilot/get-models"

import { state } from "~/lib/state"
import { server } from "~/server"

const originalFetch = globalThis.fetch
const originalModels = state.models
const originalToken = state.copilotToken
const originalManualApprove = state.manualApprove

function model(id: string, endpoints: Array<string>) {
  return {
    id,
    name: id,
    object: "model",
    vendor: id.startsWith("claude-") ? "anthropic" : "openai",
    version: "1",
    preview: false,
    model_picker_enabled: true,
    supported_endpoints: endpoints,
    capabilities: {
      family: id,
      limits: { max_output_tokens: 64000 },
      object: "model_capabilities",
      supports: { tool_calls: true },
      tokenizer: "o200k_base",
      type: "chat",
    },
  }
}

const catalog = {
  object: "list",
  data: [
    model("claude-sonnet-5", ["/v1/messages", "/chat/completions"]),
    model("gpt-5.5", ["/responses", "/chat/completions"]),
    model("gpt-4.1", ["/chat/completions"]),
  ],
} as unknown as ModelsResponse

/**
 * An SSE response that yields one usable event and then throws an AbortError
 * mid-iteration, mimicking a client disconnect during streaming.
 */
function abortingStream(firstEvent: string): Response {
  const encoder = new TextEncoder()
  let sent = false
  const body = new ReadableStream<Uint8Array>({
    pull(controller) {
      if (!sent) {
        sent = true
        controller.enqueue(encoder.encode(`${firstEvent}\n\n`))
        return
      }
      const abortError = new Error("The operation was aborted")
      abortError.name = "AbortError"
      controller.error(abortError)
    },
  })
  return new Response(body, {
    headers: { "content-type": "text/event-stream" },
  })
}

/** An SSE response that fails mid-iteration for a reason that is NOT an abort. */
function failingStream(firstEvent: string): Response {
  const encoder = new TextEncoder()
  let sent = false
  const body = new ReadableStream<Uint8Array>({
    pull(controller) {
      if (!sent) {
        sent = true
        controller.enqueue(encoder.encode(`${firstEvent}\n\n`))
        return
      }
      controller.error(new Error("upstream exploded"))
    },
  })
  return new Response(body, {
    headers: { "content-type": "text/event-stream" },
  })
}

function mockFetch(body: () => Response) {
  globalThis.fetch = mock(() =>
    Promise.resolve(body()),
  ) as unknown as typeof fetch
}

function postMessages(body: unknown) {
  return server.request("/v1/messages", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  })
}

function postChat(body: unknown) {
  return server.request("/v1/chat/completions", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  })
}

beforeEach(() => {
  state.copilotToken = "test-token"
  state.models = catalog
  state.manualApprove = false
})

afterEach(() => {
  globalThis.fetch = originalFetch
  state.models = originalModels
  state.copilotToken = originalToken
  state.manualApprove = originalManualApprove
})

const anthropicStart = `event: message_start\ndata: {"type":"message_start","message":{"id":"msg_1","role":"assistant","content":[],"model":"claude-sonnet-5"}}`
const responsesStart = `event: response.created\ndata: {"type":"response.created","response":{"id":"resp_1","model":"gpt-5.5"}}`
const chunkStart = `data: {"id":"c1","object":"chat.completion.chunk","created":1,"model":"gpt-4.1","choices":[{"index":0,"delta":{"role":"assistant","content":"hi"},"finish_reason":null}]}`

describe("streaming abort is swallowed, not surfaced as an error", () => {
  it("/v1/messages native passthrough ends cleanly on AbortError", async () => {
    mockFetch(() => abortingStream(anthropicStart))

    const response = await postMessages({
      model: "claude-sonnet-5",
      max_tokens: 64,
      stream: true,
      messages: [{ role: "user", content: "hi" }],
    })

    expect(response.status).toBe(200)
    // Consuming the body must not reject: the handler returns instead of
    // rethrowing, so the stream simply ends after what was already emitted.
    const body = await response.text()
    expect(body).toContain("message_start")
  })

  it("/v1/messages /responses tier ends cleanly on AbortError", async () => {
    mockFetch(() => abortingStream(responsesStart))

    const response = await postMessages({
      model: "gpt-5.5",
      max_tokens: 64,
      stream: true,
      messages: [{ role: "user", content: "hi" }],
    })

    expect(response.status).toBe(200)
    expect(await response.text()).toBeString()
  })

  it("/v1/messages chat-completions tier ends cleanly on AbortError", async () => {
    mockFetch(() => abortingStream(chunkStart))

    const response = await postMessages({
      model: "gpt-4.1",
      max_tokens: 64,
      stream: true,
      messages: [{ role: "user", content: "hi" }],
    })

    expect(response.status).toBe(200)
    expect(await response.text()).toBeString()
  })

  it("/v1/chat/completions passthrough tier ends cleanly on AbortError", async () => {
    mockFetch(() => abortingStream(chunkStart))

    const response = await postChat({
      model: "gpt-4.1",
      max_tokens: 64,
      stream: true,
      messages: [{ role: "user", content: "hi" }],
    })

    expect(response.status).toBe(200)
    expect(await response.text()).toBeString()
  })

  it("/v1/chat/completions /responses tier ends cleanly on AbortError", async () => {
    mockFetch(() => abortingStream(responsesStart))

    const response = await postChat({
      model: "gpt-5.5",
      max_tokens: 64,
      stream: true,
      messages: [{ role: "user", content: "hi" }],
    })

    expect(response.status).toBe(200)
    expect(await response.text()).toBeString()
  })

  it("emits a terminal OpenAI error when the upstream transport fails", async () => {
    mockFetch(() => failingStream(chunkStart))

    const response = await postChat({
      model: "gpt-4.1",
      max_tokens: 64,
      stream: true,
      messages: [{ role: "user", content: "hi" }],
    })
    const body = await response.text()

    expect(response.status).toBe(200)
    expect(body).toContain('"content":"hi"')
    expect(body.match(/"stream_transport_error"/g)).toHaveLength(1)
    expect(body).not.toContain("[DONE]")
    const errorLine = body
      .split("\n")
      .find((line) => line.startsWith('data: {"error"'))
    if (!errorLine) throw new Error("Expected OpenAI error SSE record")
    expect(JSON.parse(errorLine.slice("data: ".length))).toEqual({
      error: {
        type: "api_error",
        code: "stream_transport_error",
        message: "The upstream stream terminated unexpectedly.",
        param: null,
      },
    })
  })

  it("emits a terminal Anthropic error when the upstream transport fails", async () => {
    mockFetch(() => failingStream(anthropicStart))

    const response = await postMessages({
      model: "claude-sonnet-5",
      max_tokens: 64,
      stream: true,
      messages: [{ role: "user", content: "hi" }],
    })

    const body = await response.text()

    expect(response.status).toBe(200)
    expect(body).toContain("message_start")
    expect(body).not.toContain("message_stop")
    expect(body.match(/event: error/g)).toHaveLength(1)
    expect(body).toContain(
      'data: {"type":"error","error":{"type":"api_error","message":"The upstream stream terminated unexpectedly."}}',
    )
  })
})
