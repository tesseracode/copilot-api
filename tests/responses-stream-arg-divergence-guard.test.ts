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

const toolCallAdded = (callId = "call_x", name = "echo") => ({
  event: "response.output_item.added",
  data: {
    item: {
      type: "function_call",
      call_id: callId,
      id: "item-1",
      name,
      arguments: "",
    },
    output_index: 0,
  },
})

const argsDelta = (delta: string) => ({
  event: "response.function_call_arguments.delta",
  data: { delta, output_index: 0 },
})

const argsDone = (args: string) => ({
  event: "response.function_call_arguments.done",
  data: { arguments: args, output_index: 0 },
})

describe("syncToolArguments divergence guard", () => {
  test("identity: done equals accumulated -> zero extra chunks, no warn", () => {
    const warnSpy = spyOn(consola, "warn").mockImplementation(() => {})
    try {
      const { chunks } = runStream([
        toolCallAdded(),
        argsDelta('{"x":"hel'),
        argsDelta('lo"}'),
        argsDone('{"x":"hello"}'),
      ])
      const argDeltaChunks = chunks.filter(
        (c) => c.choices[0]?.delta?.tool_calls?.[0]?.function?.arguments,
      )
      // 2 from explicit deltas, 0 from done (identity).
      expect(argDeltaChunks).toHaveLength(2)
      expect(warnSpy).not.toHaveBeenCalled()
    } finally {
      warnSpy.mockRestore()
    }
  })

  test("extension: done extends accumulated -> exactly one suffix chunk, no warn", () => {
    const warnSpy = spyOn(consola, "warn").mockImplementation(() => {})
    try {
      const { chunks } = runStream([
        toolCallAdded(),
        argsDelta('{"x":"hel'),
        argsDone('{"x":"hello"}'),
      ])
      const argDeltaChunks = chunks.filter(
        (c) => c.choices[0]?.delta?.tool_calls?.[0]?.function?.arguments,
      )
      // 1 from delta + 1 from done suffix.
      expect(argDeltaChunks).toHaveLength(2)
      const suffix =
        argDeltaChunks[1]?.choices[0]?.delta?.tool_calls?.[0]?.function
          ?.arguments
      expect(suffix).toBe('lo"}')
      expect(warnSpy).not.toHaveBeenCalled()
    } finally {
      warnSpy.mockRestore()
    }
  })

  test("divergence: done disagrees with accumulated -> zero extra chunks, warn invoked, accumulator preserved", () => {
    const warnSpy = spyOn(consola, "warn").mockImplementation(() => {})
    try {
      const { chunks } = runStream([
        toolCallAdded(),
        argsDelta('{"x":"hello"}'),
        argsDone('{"y":"world"}'),
      ])
      const argDeltaChunks = chunks.filter(
        (c) => c.choices[0]?.delta?.tool_calls?.[0]?.function?.arguments,
      )
      // 1 from delta only; done is suppressed.
      expect(argDeltaChunks).toHaveLength(1)
      expect(warnSpy).toHaveBeenCalledTimes(1)
      const call = warnSpy.mock.calls[0] as
        | [string, Record<string, unknown>]
        | undefined
      const payload = call?.[1]
      expect(payload).toMatchObject({
        callId: "call_x",
        name: "echo",
        accumulatedLength: '{"x":"hello"}'.length,
        candidateLength: '{"y":"world"}'.length,
      })
    } finally {
      warnSpy.mockRestore()
    }
  })

  test("end-to-end on divergence: reassembled tool_use input is the streamed prefix and parses", () => {
    const warnSpy = spyOn(consola, "warn").mockImplementation(() => {})
    try {
      const { chunks } = runStream([
        toolCallAdded(),
        argsDelta('{"x":"hello"}'),
        argsDone('{"y":"world"}'),
      ])
      const anthropicState = newAnthropicState()
      const events = chunks.flatMap((c) =>
        translateChunkToAnthropicEvents(c, anthropicState),
      )
      const partialJson = events
        .filter((e) => e.type === "content_block_delta")
        .map((e) => e as { delta?: { type?: string; partial_json?: string } })
        .filter((e) => e.delta?.type === "input_json_delta")
        .map((e) => e.delta?.partial_json ?? "")
        .join("")
      expect(partialJson).toBe('{"x":"hello"}')
      expect(JSON.parse(partialJson)).toEqual({ x: "hello" })
    } finally {
      warnSpy.mockRestore()
    }
  })
})
