import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test"

import { state } from "~/lib/state"
import {
  createChatCompletions,
  type ChatCompletionsPayload,
} from "~/services/copilot/create-chat-completions"
import { createResponses } from "~/services/copilot/create-responses"
import { streamResult } from "~/services/copilot/service-result"

const originalFetch = globalThis.fetch
const payload: ChatCompletionsPayload = {
  model: "gpt-test",
  messages: [{ role: "user", content: "hello" }],
}

beforeEach(() => {
  state.copilotToken = "test-token"
})

afterEach(() => {
  globalThis.fetch = originalFetch
})

function mockJson(body: unknown): void {
  globalThis.fetch = mock(() =>
    Promise.resolve(Response.json(body)),
  ) as unknown as typeof fetch
}

function mockSSE(): void {
  globalThis.fetch = mock(() =>
    Promise.resolve(
      new Response("data: [DONE]\n\n", {
        headers: { "content-type": "text/event-stream" },
      }),
    ),
  ) as unknown as typeof fetch
}

describe("discriminated service results", () => {
  it("dispatches streams by kind even when they expose choices", () => {
    const misleadingStream = {
      choices: [],
      async *[Symbol.asyncIterator]() {
        yield await Promise.resolve("event")
      },
    }
    const result = streamResult(misleadingStream)

    expect(result.kind).toBe("stream")
    expect(result.stream.choices).toEqual([])
  })

  it("wraps Chat non-stream responses as object results", async () => {
    mockJson({
      id: "chat_1",
      object: "chat.completion",
      created: 0,
      model: "gpt-test",
      choices: [],
    })

    const result = await createChatCompletions({ ...payload, stream: false })

    expect(result).toMatchObject({
      kind: "object",
      body: { id: "chat_1", object: "chat.completion" },
    })
  })

  it("wraps Chat streams as stream results", async () => {
    mockSSE()

    const result = await createChatCompletions({ ...payload, stream: true })

    expect(result.kind).toBe("stream")
    expect(result).toHaveProperty("stream")
  })

  it("wraps Responses non-stream responses as object results", async () => {
    mockJson({
      id: "resp_1",
      object: "response",
      model: "gpt-test",
      output: [],
    })

    const result = await createResponses({ ...payload, stream: false })

    expect(result).toMatchObject({
      kind: "object",
      body: { id: "resp_1", object: "chat.completion" },
    })
  })

  it("wraps Responses streams as stream results", async () => {
    mockSSE()

    const result = await createResponses({ ...payload, stream: true })

    expect(result.kind).toBe("stream")
    expect(result).toHaveProperty("stream")
  })
})
