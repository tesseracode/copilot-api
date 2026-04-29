import { describe, expect, test } from "bun:test"

import {
  createResponsesStreamState,
  translateResponsesStreamEvent,
} from "~/services/copilot/create-responses"

const FALLBACK_ID_RE = /^chatcmpl-[0-9a-f-]{36}$/

function collectChunks(
  events: Array<{ event: string; data: Record<string, unknown> }>,
) {
  const state = createResponsesStreamState()
  const chunks = events.flatMap((event) =>
    Array.from(translateResponsesStreamEvent(event, state)),
  )
  return { state, chunks }
}

describe("Responses streaming chunk identity", () => {
  test("all chunks share one created timestamp", () => {
    const { chunks } = collectChunks([
      {
        event: "response.output_text.delta",
        data: { delta: "hello", output_index: 0 },
      },
      {
        event: "response.output_text.delta",
        data: { delta: " world", output_index: 0 },
      },
      {
        event: "response.completed",
        data: { response: { id: "resp-late", model: "gpt-test" } },
      },
    ])

    expect(chunks.length).toBeGreaterThan(0)
    const createdValues = new Set(chunks.map((c) => c.created))
    expect(createdValues.size).toBe(1)
  })

  test("upstream id from response.created is used uniformly when it arrives first", () => {
    const { chunks } = collectChunks([
      {
        event: "response.created",
        data: { response: { id: "resp-early", model: "gpt-test" } },
      },
      {
        event: "response.output_text.delta",
        data: { delta: "hi", output_index: 0 },
      },
      {
        event: "response.completed",
        data: { response: { id: "resp-early", model: "gpt-test" } },
      },
    ])

    expect(chunks.length).toBeGreaterThan(0)
    for (const chunk of chunks) {
      expect(chunk.id).toBe("resp-early")
    }
  })

  test("fallback id is stable across chunks when response.created never arrives", () => {
    const { chunks } = collectChunks([
      {
        event: "response.output_text.delta",
        data: { delta: "a", output_index: 0 },
      },
      {
        event: "response.output_text.delta",
        data: { delta: "b", output_index: 0 },
      },
      {
        event: "response.output_text.delta",
        data: { delta: "c", output_index: 0 },
      },
    ])

    expect(chunks.length).toBe(3)
    const ids = new Set(chunks.map((c) => c.id))
    expect(ids.size).toBe(1)
    const [id] = ids
    expect(id).toMatch(FALLBACK_ID_RE)
  })

  test("once upstream id is known via response.created, all later chunks use it", () => {
    const { chunks } = collectChunks([
      {
        event: "response.output_text.delta",
        data: { delta: "pre", output_index: 0 },
      },
      {
        event: "response.created",
        data: { response: { id: "resp-mid", model: "gpt-test" } },
      },
      {
        event: "response.output_text.delta",
        data: { delta: "post", output_index: 0 },
      },
      {
        event: "response.completed",
        data: { response: { id: "resp-mid", model: "gpt-test" } },
      },
    ])

    const afterCreated = chunks.slice(1)
    expect(afterCreated.length).toBeGreaterThan(0)
    for (const chunk of afterCreated) {
      expect(chunk.id).toBe("resp-mid")
    }
    expect(chunks[0]?.id).toMatch(FALLBACK_ID_RE)
  })

  test("responseId is locked after first assignment even if upstream sends different ids in later lifecycle events", () => {
    const { chunks } = collectChunks([
      {
        event: "response.created",
        data: { response: { id: "resp-A", model: "gpt-test" } },
      },
      {
        event: "response.in_progress",
        data: { response: { id: "resp-B", model: "gpt-test-2" } },
      },
      {
        event: "response.output_text.delta",
        data: { delta: "hi", output_index: 0 },
      },
      {
        event: "response.completed",
        data: { response: { id: "resp-C", model: "gpt-test-3" } },
      },
    ])

    expect(chunks.length).toBeGreaterThan(0)
    for (const chunk of chunks) {
      expect(chunk.id).toBe("resp-A")
      expect(chunk.model).toBe("gpt-test")
    }
  })
})
