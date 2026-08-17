import { describe, expect, spyOn, test } from "bun:test"
import consola from "consola"

import type { AnthropicStreamState } from "~/routes/messages/anthropic-types"

import { translateChunkToAnthropicEvents } from "~/routes/messages/stream-translation"
import {
  createResponsesStreamState,
  translateResponsesStreamEvent,
} from "~/services/copilot/create-responses"

interface ToolCallDelta {
  index?: number
  id?: string
  function?: { name?: string; arguments?: string }
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

/** Reassembles exactly what a client concatenating deltas would receive. */
function assembledArguments(chunks: Array<unknown>): string {
  let assembled = ""
  for (const chunk of chunks) {
    const typed = chunk as {
      choices?: Array<{ delta?: { tool_calls?: Array<ToolCallDelta> } }>
    }
    for (const call of typed.choices?.[0]?.delta?.tool_calls ?? []) {
      assembled += call.function?.arguments ?? ""
    }
  }
  return assembled
}

function firstToolCallDelta(chunks: Array<unknown>): ToolCallDelta | undefined {
  for (const chunk of chunks) {
    const typed = chunk as {
      choices?: Array<{ delta?: { tool_calls?: Array<ToolCallDelta> } }>
    }
    const call = typed.choices?.[0]?.delta?.tool_calls?.[0]
    if (call) return call
  }
  return undefined
}

const added = (args = "", callId = "call_x", name = "echo") => ({
  event: "response.output_item.added",
  data: {
    item: {
      type: "function_call",
      call_id: callId,
      id: "item-1",
      name,
      arguments: args,
    },
    output_index: 1,
  },
})

/** Live Copilot deltas carry neither name nor call_id, only output_index. */
const delta = (text: string) => ({
  event: "response.function_call_arguments.delta",
  data: { delta: text, output_index: 1 },
})

const argsDone = (args: string) => ({
  event: "response.function_call_arguments.done",
  data: { arguments: args, output_index: 1 },
})

const itemDone = (args: string, callId = "call_x", name = "echo") => ({
  event: "response.output_item.done",
  data: {
    item: {
      type: "function_call",
      call_id: callId,
      id: "item-1",
      name,
      arguments: args,
    },
    output_index: 1,
  },
})

describe("delta arriving before output_item.added", () => {
  test("assembles the complete arguments for the racing order", () => {
    const { chunks } = runStream([
      delta('{"a"'),
      added(),
      delta(":1}"),
      argsDone('{"a":1}'),
    ])

    expect(assembledArguments(chunks)).toBe('{"a":1}')
  })

  test("still emits id and name on the first tool call chunk", () => {
    const { chunks } = runStream([delta('{"a"'), added(), delta(":1}")])

    const first = firstToolCallDelta(chunks)
    expect(first?.id).toBe("call_x")
    expect(first?.function?.name).toBe("echo")
  })

  test("emits nothing for the orphan delta itself", () => {
    const { chunks } = runStream([delta('{"a"')])

    expect(chunks).toHaveLength(0)
  })

  test("does not trigger the divergence guard", () => {
    const warn = spyOn(consola, "warn").mockImplementation(
      (() => undefined) as never,
    )

    runStream([delta('{"a"'), added(), delta(":1}"), argsDone('{"a":1}')])

    expect(warn).not.toHaveBeenCalled()
    warn.mockRestore()
  })

  test("does not duplicate text already present on the added item", () => {
    const { chunks } = runStream([
      delta('{"a"'),
      added('{"a"'),
      delta(":1}"),
      argsDone('{"a":1}'),
    ])

    expect(assembledArguments(chunks)).toBe('{"a":1}')
  })

  test("completes correctly when only output_item.done follows", () => {
    const { chunks } = runStream([delta('{"a"'), itemDone('{"a":1}')])

    expect(assembledArguments(chunks)).toBe('{"a":1}')
  })

  test("does not leak a stale buffer into a later item at the same index", () => {
    const { chunks } = runStream([
      delta('{"orphan"'),
      itemDone('{"first":1}'),
      added("", "call_y", "second"),
      delta('{"b":2}'),
    ])

    expect(assembledArguments(chunks)).toBe('{"first":1}{"b":2}')
  })

  test("reaches the Anthropic path as one block with complete input", () => {
    const { chunks } = runStream([
      delta('{"a"'),
      added(),
      delta(":1}"),
      argsDone('{"a":1}'),
    ])

    const anthropicState: AnthropicStreamState = {
      messageStartSent: false,
      contentBlockIndex: 0,
      contentBlockOpen: false,
      toolCalls: {},
    }
    const events = chunks.flatMap((chunk) =>
      translateChunkToAnthropicEvents(chunk, anthropicState),
    )

    const starts = events.filter(
      (event) =>
        event.type === "content_block_start"
        && (event as { content_block?: { type?: string } }).content_block?.type
          === "tool_use",
    )
    expect(starts).toHaveLength(1)

    const partial = events
      .filter((event) => event.type === "content_block_delta")
      .map(
        (event) =>
          (event as { delta?: { partial_json?: string } }).delta?.partial_json
          ?? "",
      )
      .join("")
    expect(partial).toBe('{"a":1}')
  })
})

describe("normal ordering is unchanged", () => {
  test("assembles arguments and buffers nothing", () => {
    const { chunks, state } = runStream([
      added(),
      delta('{"a"'),
      delta(":1}"),
      argsDone('{"a":1}'),
    ])

    expect(assembledArguments(chunks)).toBe('{"a":1}')
    expect(state.orphanArgumentsByOutputIndex.size).toBe(0)
  })

  test("produces the same chunks as before the recovery path existed", () => {
    const { chunks } = runStream([added(), delta('{"a"'), delta(":1}")])

    const first = firstToolCallDelta(chunks)
    expect(first?.id).toBe("call_x")
    expect(first?.function?.name).toBe("echo")
    expect(assembledArguments(chunks)).toBe('{"a"' + ":1}")
  })
})
