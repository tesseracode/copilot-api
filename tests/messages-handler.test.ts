/**
 * Characterization coverage for src/routes/messages/handler.ts.
 *
 * These tests pin what the handler does TODAY so that a later restructure is
 * safe. They are deliberately not a specification: where a case pins behaviour
 * already flagged as questionable, the comment names the
 * .tpatch/POTENTIAL_FEATURES.md entry.
 *
 * The three `signal` cases are the point of the suite.
 * tests/responses-stream-abort-propagation.test.ts already proves the *services*
 * forward an AbortSignal, but it calls them directly, so nothing checks that the
 * *handler* wires one through. That blind spot is how the reroute defect shipped
 * (handleNativeReroute simply omitted the signal).
 */
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  mock,
  spyOn,
} from "bun:test"
import consola from "consola"

import type { ModelsResponse } from "~/services/copilot/get-models"

import { state } from "~/lib/state"
import { server } from "~/server"

const originalFetch = globalThis.fetch
const originalModels = state.models
const originalToken = state.copilotToken
const originalManualApprove = state.manualApprove
const original1MContext = state.is1MContext

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
    model("claude-opus-4.6", ["/v1/messages"]),
    model("claude-opus-4.6-1m", ["/v1/messages"]),
    model("gpt-5.5", ["/responses", "/chat/completions"]),
    model("gpt-4.1", ["/chat/completions"]),
  ],
} as unknown as ModelsResponse

function sse(...events: Array<string>): Response {
  return new Response(`${events.join("\n\n")}\n\n`, {
    headers: { "content-type": "text/event-stream" },
  })
}

interface FetchCall {
  url: string
  init?: RequestInit
}

function urlOf(input: string | URL | Request): string {
  if (typeof input === "string") return input
  if (input instanceof URL) return input.href
  return input.url
}

/** Read a recorded request body, which is always a JSON string here. */
function bodyOf(call: FetchCall): Record<string, unknown> {
  const raw = call.init?.body
  if (typeof raw !== "string") throw new TypeError("Expected a JSON body")
  return JSON.parse(raw) as Record<string, unknown>
}

/** Mock fetch, recording every call, returning `body` each time. */
function mockFetch(body: () => Response): Array<FetchCall> {
  const calls: Array<FetchCall> = []
  globalThis.fetch = mock(
    (input: string | URL | Request, init?: RequestInit) => {
      calls.push({ url: urlOf(input), init })
      return Promise.resolve(body())
    },
  ) as unknown as typeof fetch
  return calls
}

function anthropicMessage() {
  return Response.json({
    id: "msg_1",
    type: "message",
    role: "assistant",
    model: "claude-sonnet-5",
    content: [{ type: "text", text: "hello" }],
    stop_reason: "end_turn",
    usage: { input_tokens: 5, output_tokens: 2 },
  })
}

function openAICompletion(modelId: string) {
  return Response.json({
    id: "c1",
    object: "chat.completion",
    created: 1,
    model: modelId,
    choices: [
      {
        index: 0,
        message: { role: "assistant", content: "hello" },
        logprobs: null,
        finish_reason: "stop",
      },
    ],
    usage: { prompt_tokens: 5, completion_tokens: 2, total_tokens: 7 },
  })
}

function responsesPayload() {
  return Response.json({
    id: "resp_1",
    object: "response",
    model: "gpt-5.5",
    output: [
      {
        type: "message",
        role: "assistant",
        content: [{ type: "output_text", text: "hello" }],
      },
    ],
    usage: { input_tokens: 5, output_tokens: 2, total_tokens: 7 },
  })
}

function post(body: unknown, headers: Record<string, string> = {}) {
  return server.request("/v1/messages", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  })
}

beforeEach(() => {
  state.copilotToken = "test-token"
  state.models = catalog
  state.manualApprove = false
  state.is1MContext = false
})

afterEach(() => {
  globalThis.fetch = originalFetch
  state.models = originalModels
  state.copilotToken = originalToken
  state.manualApprove = originalManualApprove
  state.is1MContext = original1MContext
})

// ── Tier A — native /v1/messages passthrough (Claude) ────────────────────────

describe("/v1/messages → native passthrough (Claude)", () => {
  it("forwards non-streaming requests to the upstream /v1/messages endpoint", async () => {
    const calls = mockFetch(anthropicMessage)

    const response = await post({
      model: "claude-sonnet-5",
      max_tokens: 64,
      messages: [{ role: "user", content: "hi" }],
    })

    expect(response.status).toBe(200)
    expect(calls).toHaveLength(1)
    expect(calls[0].url).toEndWith("/v1/messages")
    expect(await response.json()).toMatchObject({
      id: "msg_1",
      content: [{ type: "text", text: "hello" }],
    })
  })

  it("passes streaming events through untranslated", async () => {
    mockFetch(() =>
      sse(
        `event: message_start\ndata: {"type":"message_start","message":{"id":"msg_1","role":"assistant","content":[],"model":"claude-sonnet-5"}}`,
        `event: content_block_delta\ndata: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"hi"}}`,
        `event: message_stop\ndata: {"type":"message_stop"}`,
      ),
    )

    const response = await post({
      model: "claude-sonnet-5",
      max_tokens: 64,
      stream: true,
      messages: [{ role: "user", content: "hi" }],
    })

    expect(response.status).toBe(200)
    const body = await response.text()
    expect(body).toContain("event: message_start")
    expect(body).toContain("text_delta")
    expect(body).toContain("event: message_stop")
  })

  it("wires the request AbortSignal through to the upstream fetch", async () => {
    const calls = mockFetch(anthropicMessage)

    await post({
      model: "claude-sonnet-5",
      max_tokens: 64,
      messages: [{ role: "user", content: "hi" }],
    })

    expect(calls[0].init?.signal).toBeDefined()
  })
})

// ── Tier B — /responses (GPT-5.x arriving on /v1/messages) ────────────────────

describe("/v1/messages → /responses (GPT-5.x)", () => {
  it("returns a non-streaming /responses result in Anthropic shape", async () => {
    const calls = mockFetch(responsesPayload)

    const response = await post({
      model: "gpt-5.5",
      max_tokens: 64,
      messages: [{ role: "user", content: "hi" }],
    })

    expect(response.status).toBe(200)
    expect(calls[0].url).toEndWith("/responses")
    expect(await response.json()).toMatchObject({
      type: "message",
      role: "assistant",
      content: [{ type: "text", text: "hello" }],
    })
  })

  it("translates a /responses stream into Anthropic events", async () => {
    mockFetch(() =>
      sse(
        `event: response.created\ndata: {"type":"response.created","response":{"id":"resp_1","model":"gpt-5.5"}}`,
        `event: response.output_text.delta\ndata: {"type":"response.output_text.delta","delta":"hi"}`,
        `event: response.completed\ndata: {"type":"response.completed","response":{"id":"resp_1","model":"gpt-5.5","usage":{"input_tokens":5,"output_tokens":2,"total_tokens":7}}}`,
      ),
    )

    const response = await post({
      model: "gpt-5.5",
      max_tokens: 64,
      stream: true,
      messages: [{ role: "user", content: "hi" }],
    })

    expect(response.status).toBe(200)
    const body = await response.text()
    expect(body).toContain("message_start")
    expect(body).toContain("text_delta")
  })

  it("wires the request AbortSignal through to the upstream fetch", async () => {
    const calls = mockFetch(responsesPayload)

    await post({
      model: "gpt-5.5",
      max_tokens: 64,
      messages: [{ role: "user", content: "hi" }],
    })

    expect(calls[0].init?.signal).toBeDefined()
  })
})

// ── Tier C — /chat/completions fallback (legacy models) ───────────────────────

describe("/v1/messages → /chat/completions (legacy)", () => {
  it("returns a non-streaming completion in Anthropic shape", async () => {
    const calls = mockFetch(() => openAICompletion("gpt-4.1"))

    const response = await post({
      model: "gpt-4.1",
      max_tokens: 64,
      messages: [{ role: "user", content: "hi" }],
    })

    expect(response.status).toBe(200)
    expect(calls[0].url).toEndWith("/chat/completions")
    // Pins the isNonStreaming duck-type discriminator
    // (POTENTIAL_FEATURES.md #3): a body carrying `choices` is treated as
    // non-streaming.
    expect(await response.json()).toMatchObject({
      type: "message",
      role: "assistant",
      stop_reason: "end_turn",
      content: [{ type: "text", text: "hello" }],
    })
  })

  it("translates a completion stream into Anthropic events", async () => {
    mockFetch(() =>
      sse(
        `data: {"id":"c1","object":"chat.completion.chunk","created":1,"model":"gpt-4.1","choices":[{"index":0,"delta":{"role":"assistant","content":"hi"},"finish_reason":null}]}`,
        `data: {"id":"c1","object":"chat.completion.chunk","created":1,"model":"gpt-4.1","choices":[{"index":0,"delta":{},"finish_reason":"stop"}]}`,
        `data: [DONE]`,
      ),
    )

    const response = await post({
      model: "gpt-4.1",
      max_tokens: 64,
      stream: true,
      messages: [{ role: "user", content: "hi" }],
    })

    expect(response.status).toBe(200)
    const body = await response.text()
    expect(body).toContain("message_start")
    expect(body).toContain("text_delta")
    expect(body).toContain("message_stop")
  })

  it("wires the request AbortSignal through to the upstream fetch", async () => {
    const calls = mockFetch(() => openAICompletion("gpt-4.1"))

    await post({
      model: "gpt-4.1",
      max_tokens: 64,
      messages: [{ role: "user", content: "hi" }],
    })

    expect(calls[0].init?.signal).toBeDefined()
  })
})

// ── Cross-cutting handler behaviour ──────────────────────────────────────────

describe("/v1/messages handler gates", () => {
  it("selects the 1M variant from the anthropic-beta header", async () => {
    const calls = mockFetch(anthropicMessage)

    await post(
      {
        model: "claude-opus-4.6",
        max_tokens: 64,
        messages: [{ role: "user", content: "hi" }],
      },
      { "anthropic-beta": "context-1m-2025-08-07" },
    )

    expect(bodyOf(calls[0]).model).toBe("claude-opus-4.6-1m")
  })

  it("selects the 1M variant from the global is1MContext flag", async () => {
    state.is1MContext = true
    const calls = mockFetch(anthropicMessage)

    await post({
      model: "claude-opus-4.6",
      max_tokens: 64,
      messages: [{ role: "user", content: "hi" }],
    })

    expect(bodyOf(calls[0]).model).toBe("claude-opus-4.6-1m")
  })

  it("rejects with 403 and makes no upstream call when approval is declined", async () => {
    state.manualApprove = true
    const promptSpy = spyOn(consola, "prompt").mockResolvedValue(false as never)
    const calls = mockFetch(anthropicMessage)

    try {
      const response = await post({
        model: "claude-sonnet-5",
        max_tokens: 64,
        messages: [{ role: "user", content: "hi" }],
      })

      expect(response.status).toBe(403)
      expect(calls).toHaveLength(0)
    } finally {
      promptSpy.mockRestore()
    }
  })
})
