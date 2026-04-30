import { afterEach, beforeEach, describe, expect, spyOn, test } from "bun:test"

import { state } from "~/lib/state"
import { createChatCompletions } from "~/services/copilot/create-chat-completions"
import { createResponses } from "~/services/copilot/create-responses"
import {
  forwardNativeMessages,
  forwardNativeMessagesNonStreaming,
  forwardNativeMessagesStreaming,
} from "~/services/copilot/forward-native-messages"

function emptyJsonResponse() {
  return new Response(
    JSON.stringify({
      id: "x",
      object: "chat.completion",
      created: 0,
      model: "gpt-test",
      choices: [
        {
          index: 0,
          message: { role: "assistant", content: "" },
          logprobs: null,
          finish_reason: "stop",
        },
      ],
    }),
    { headers: { "content-type": "application/json" } },
  )
}

function emptyStreamResponse() {
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.close()
    },
  })
  return new Response(stream, {
    headers: { "content-type": "text/event-stream" },
  })
}

function lastFetchInit(
  spy: ReturnType<typeof spyOn<typeof globalThis, "fetch">>,
): RequestInit | undefined {
  const calls = spy.mock.calls as Array<[unknown, RequestInit | undefined]>
  return calls.at(-1)?.[1]
}

let originalToken: string | undefined

beforeEach(() => {
  originalToken = state.copilotToken
  state.copilotToken = "test-token"
})

afterEach(() => {
  state.copilotToken = originalToken
})

describe("AbortSignal propagation to upstream fetch", () => {
  test("createChatCompletions forwards signal", async () => {
    const fetchSpy = spyOn(globalThis, "fetch").mockResolvedValue(
      emptyJsonResponse(),
    )
    try {
      const controller = new AbortController()
      await createChatCompletions(
        {
          model: "gpt-test",
          messages: [{ role: "user", content: "hi" }],
        },
        controller.signal,
      )
      expect(lastFetchInit(fetchSpy)?.signal).toBe(controller.signal)
    } finally {
      fetchSpy.mockRestore()
    }
  })

  test("createResponses forwards signal on non-streaming path", async () => {
    const fetchSpy = spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          id: "x",
          object: "response",
          model: "gpt-test",
          output: [],
        }),
        { headers: { "content-type": "application/json" } },
      ),
    )
    try {
      const controller = new AbortController()
      await createResponses(
        {
          model: "gpt-test",
          messages: [{ role: "user", content: "hi" }],
        },
        controller.signal,
      )
      expect(lastFetchInit(fetchSpy)?.signal).toBe(controller.signal)
    } finally {
      fetchSpy.mockRestore()
    }
  })

  test("createResponses forwards signal on streaming path", async () => {
    const fetchSpy = spyOn(globalThis, "fetch").mockResolvedValue(
      emptyStreamResponse(),
    )
    try {
      const controller = new AbortController()
      const result = await createResponses(
        {
          model: "gpt-test",
          messages: [{ role: "user", content: "hi" }],
          stream: true,
        },
        controller.signal,
      )
      // Drain to ensure the iterator runs.
      if (Symbol.asyncIterator in (result as object)) {
        for await (const _ of result as AsyncIterable<unknown>) {
          void _
        }
      }
      expect(lastFetchInit(fetchSpy)?.signal).toBe(controller.signal)
    } finally {
      fetchSpy.mockRestore()
    }
  })

  test("forwardNativeMessages forwards signal", async () => {
    const fetchSpy = spyOn(globalThis, "fetch").mockResolvedValue(
      emptyJsonResponse(),
    )
    try {
      const controller = new AbortController()
      await forwardNativeMessages(
        {
          model: "claude-test",
          messages: [{ role: "user", content: "hi" }],
          max_tokens: 16,
        },
        false,
        false,
        controller.signal,
      )
      expect(lastFetchInit(fetchSpy)?.signal).toBe(controller.signal)
    } finally {
      fetchSpy.mockRestore()
    }
  })

  test("forwardNativeMessagesNonStreaming forwards signal", async () => {
    const fetchSpy = spyOn(globalThis, "fetch").mockResolvedValue(
      emptyJsonResponse(),
    )
    try {
      const controller = new AbortController()
      await forwardNativeMessagesNonStreaming(
        {
          model: "claude-test",
          messages: [{ role: "user", content: "hi" }],
          max_tokens: 16,
        },
        false,
        controller.signal,
      )
      expect(lastFetchInit(fetchSpy)?.signal).toBe(controller.signal)
    } finally {
      fetchSpy.mockRestore()
    }
  })

  test("forwardNativeMessagesStreaming forwards signal", async () => {
    const fetchSpy = spyOn(globalThis, "fetch").mockResolvedValue(
      emptyStreamResponse(),
    )
    try {
      const controller = new AbortController()
      const iter = forwardNativeMessagesStreaming(
        {
          model: "claude-test",
          messages: [{ role: "user", content: "hi" }],
          max_tokens: 16,
        },
        false,
        controller.signal,
      )
      for await (const _ of iter) {
        void _
      }
      expect(lastFetchInit(fetchSpy)?.signal).toBe(controller.signal)
    } finally {
      fetchSpy.mockRestore()
    }
  })

  test("pre-aborted signal: fetch sees aborted=true", async () => {
    const fetchSpy = spyOn(globalThis, "fetch").mockResolvedValue(
      emptyJsonResponse(),
    )
    try {
      const controller = new AbortController()
      controller.abort()
      try {
        await createChatCompletions(
          {
            model: "gpt-test",
            messages: [{ role: "user", content: "hi" }],
          },
          controller.signal,
        )
      } catch {
        // fetch may throw on aborted signal; that's OK.
      }
      const init = lastFetchInit(fetchSpy)
      expect(init?.signal?.aborted).toBe(true)
    } finally {
      fetchSpy.mockRestore()
    }
  })
})
