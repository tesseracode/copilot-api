import { describe, expect, spyOn, test } from "bun:test"
import consola from "consola"

import type { AnthropicStreamState } from "~/routes/messages/anthropic-types"

import { translateChunkToAnthropicEvents } from "~/routes/messages/stream-translation"
import {
  createResponsesStreamState,
  translateResponsesStreamEvent,
} from "~/services/copilot/create-responses"

function newAnthropicState(): AnthropicStreamState {
  return {
    messageStartSent: false,
    contentBlockIndex: 0,
    contentBlockOpen: false,
    toolCalls: {},
  }
}

function runStream(
  events: Array<{ event: string; data: Record<string, unknown> }>,
) {
  const state = createResponsesStreamState()
  const chunks = events.flatMap((event) =>
    Array.from(translateResponsesStreamEvent(event, state)),
  )
  return { state, chunks }
}

function translateChunks(chunks: ReturnType<typeof runStream>["chunks"]) {
  const anthropicState = newAnthropicState()
  return chunks.flatMap((chunk) =>
    translateChunkToAnthropicEvents(chunk, anthropicState),
  )
}

const created = (id = "resp-1", model = "gpt-test") => ({
  event: "response.created",
  data: { response: { id, model } },
})

const textDelta = (delta: string) => ({
  event: "response.output_text.delta",
  data: { delta, output_index: 0 },
})

describe("Responses streaming terminal-error events", () => {
  test("response.failed yields one chunk with error and emits Anthropic error event", () => {
    const warnSpy = spyOn(consola, "warn").mockImplementation(() => {})
    try {
      const { chunks } = runStream([
        created(),
        textDelta("hi"),
        {
          event: "response.failed",
          data: {
            response: {
              id: "resp-1",
              error: {
                type: "rate_limit_exceeded",
                message: "too many requests",
              },
            },
          },
        },
      ])

      const errorChunks = chunks.filter((c) => c.error)
      expect(errorChunks).toHaveLength(1)
      expect(errorChunks[0]?.error).toEqual({
        type: "rate_limit_exceeded",
        message: "too many requests",
      })
      expect(errorChunks[0]?.choices[0]?.finish_reason).toBeNull()

      const events = translateChunks(chunks)
      const errorEvents = events.filter((e) => e.type === "error")
      expect(errorEvents).toHaveLength(1)
      expect(events.at(-1)?.type).toBe("error")
      const last = errorEvents[0] as {
        error: { type: string; message: string }
      }
      expect(last.error).toEqual({
        type: "rate_limit_exceeded",
        message: "too many requests",
      })
      expect(events.some((e) => e.type === "message_stop")).toBe(false)
      expect(events.some((e) => e.type === "content_block_stop")).toBe(true)
      expect(warnSpy).toHaveBeenCalledTimes(1)
    } finally {
      warnSpy.mockRestore()
    }
  })

  test("generic error event yields chunk with error and emits Anthropic error event", () => {
    const warnSpy = spyOn(consola, "warn").mockImplementation(() => {})
    try {
      const { chunks } = runStream([
        created(),
        {
          event: "error",
          data: { code: "internal_error", message: "boom" },
        },
      ])

      const errorChunks = chunks.filter((c) => c.error)
      expect(errorChunks).toHaveLength(1)
      expect(errorChunks[0]?.error?.type).toBe("internal_error")
      expect(errorChunks[0]?.error?.message).toBe("boom")

      const events = translateChunks(chunks)
      const errorEvents = events.filter((e) => e.type === "error")
      expect(errorEvents).toHaveLength(1)
      const last = errorEvents[0] as {
        error: { type: string; message: string }
      }
      expect(last.error.type).toBe("internal_error")
      expect(last.error.message).toBe("boom")
      expect(events.some((e) => e.type === "message_stop")).toBe(false)
      expect(warnSpy).toHaveBeenCalledTimes(1)
    } finally {
      warnSpy.mockRestore()
    }
  })

  test("response.incomplete with max_output_tokens maps to length and emits message_stop", () => {
    const warnSpy = spyOn(consola, "warn").mockImplementation(() => {})
    try {
      const { chunks } = runStream([
        created(),
        textDelta("hi"),
        {
          event: "response.incomplete",
          data: {
            response: {
              id: "resp-1",
              incomplete_details: { reason: "max_output_tokens" },
            },
          },
        },
      ])

      const terminal = chunks.at(-1)
      expect(terminal?.choices[0]?.finish_reason).toBe("length")
      expect(terminal?.error).toBeUndefined()

      const events = translateChunks(chunks)
      expect(events.some((e) => e.type === "message_stop")).toBe(true)
      expect(events.some((e) => e.type === "error")).toBe(false)
      const md = events.find((e) => e.type === "message_delta") as
        | { delta: { stop_reason: string | null } }
        | undefined
      expect(md?.delta.stop_reason).toBe("max_tokens")
      expect(warnSpy).not.toHaveBeenCalled()
    } finally {
      warnSpy.mockRestore()
    }
  })

  test("response.incomplete with no reason maps to stop", () => {
    const warnSpy = spyOn(consola, "warn").mockImplementation(() => {})
    try {
      const { chunks } = runStream([
        created(),
        textDelta("hi"),
        {
          event: "response.incomplete",
          data: {
            response: {
              id: "resp-1",
              incomplete_details: {},
            },
          },
        },
      ])

      const terminal = chunks.at(-1)
      expect(terminal?.choices[0]?.finish_reason).toBe("stop")
      expect(warnSpy).not.toHaveBeenCalled()
    } finally {
      warnSpy.mockRestore()
    }
  })
})
