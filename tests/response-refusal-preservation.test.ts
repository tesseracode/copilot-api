import { describe, expect, it } from "bun:test"

import { createAnthropicStreamState } from "~/routes/messages/anthropic-types"
import { translateToAnthropic } from "~/routes/messages/non-stream-translation"
import { translateChunkToAnthropicEvents } from "~/routes/messages/stream-translation"
import {
  createResponsesStreamState,
  translateResponsesNonStreaming,
  translateResponsesStreamEvent,
  type ResponsesResponse,
} from "~/services/copilot/create-responses"

function stream(
  events: Array<{ event: string; data: Record<string, unknown> }>,
) {
  const responsesState = createResponsesStreamState()
  const anthropicState = createAnthropicStreamState()
  const chunks = events.flatMap((event) => [
    ...translateResponsesStreamEvent(event, responsesState),
  ])
  const anthropic = chunks.flatMap((chunk) =>
    translateChunkToAnthropicEvents(chunk, anthropicState),
  )
  return { chunks, anthropic }
}

function incomplete(reason: string) {
  return {
    event: "response.incomplete",
    data: {
      type: "response.incomplete",
      response: {
        id: "resp_filter",
        model: "gpt-test",
        incomplete_details: { reason },
        usage: { input_tokens: 10, output_tokens: 1, total_tokens: 11 },
      },
    },
  }
}

describe("response refusal preservation", () => {
  it("maps streaming content_filter to Anthropic refusal", () => {
    const result = stream([incomplete("content_filter")])
    expect(result.chunks.at(-1)?.choices[0].finish_reason).toBe(
      "content_filter",
    )
    expect(result.anthropic).toContainEqual({
      type: "message_delta",
      delta: { stop_reason: "refusal", stop_sequence: null },
      usage: { input_tokens: 10, output_tokens: 1 },
    })
    expect(result.anthropic.some((event) => event.type === "error")).toBe(false)
  })

  it("preserves partial text before a refusal terminal reason", () => {
    const result = stream([
      {
        event: "response.output_text.delta",
        data: { type: "response.output_text.delta", delta: "partial" },
      },
      incomplete("content_filter"),
    ])
    expect(result.anthropic).toContainEqual({
      type: "content_block_delta",
      index: 0,
      delta: { type: "text_delta", text: "partial" },
    })
    expect(result.anthropic).toContainEqual({
      type: "message_delta",
      delta: { stop_reason: "refusal", stop_sequence: null },
      usage: { input_tokens: 10, output_tokens: 1 },
    })
  })

  it("preserves streaming refusal text exactly once", () => {
    const result = stream([
      {
        event: "response.refusal.delta",
        data: { type: "response.refusal.delta", delta: "I cannot help" },
      },
      {
        event: "response.refusal.done",
        data: { type: "response.refusal.done", refusal: "I cannot help" },
      },
      {
        event: "response.completed",
        data: {
          type: "response.completed",
          response: { id: "resp_refusal", model: "gpt-test" },
        },
      },
    ])
    const refusalText = result.chunks
      .map((chunk) => chunk.choices[0].delta.refusal ?? "")
      .join("")
    expect(refusalText).toBe("I cannot help")
    expect(result.chunks.at(-1)?.choices[0].finish_reason).toBe(
      "content_filter",
    )
    expect(result.anthropic).toContainEqual({
      type: "content_block_delta",
      index: 0,
      delta: { type: "text_delta", text: "I cannot help" },
    })
    expect(result.anthropic).toContainEqual({
      type: "message_delta",
      delta: { stop_reason: "refusal", stop_sequence: null },
      usage: { input_tokens: 0, output_tokens: 0 },
    })
  })

  it("preserves non-stream incomplete content_filter", () => {
    const chat = translateResponsesNonStreaming({
      id: "resp_filter",
      object: "response",
      model: "gpt-test",
      status: "incomplete",
      incomplete_details: { reason: "content_filter" },
      output: [],
    } as ResponsesResponse)
    expect(chat.choices[0].finish_reason).toBe("content_filter")
    expect(translateToAnthropic(chat).stop_reason).toBe("refusal")
  })

  it("preserves non-stream refusal text", () => {
    const chat = translateResponsesNonStreaming({
      id: "resp_refusal",
      object: "response",
      model: "gpt-test",
      output: [
        {
          type: "message",
          role: "assistant",
          content: [{ type: "refusal", refusal: "I cannot help" }],
        },
      ],
    } as unknown as ResponsesResponse)
    expect(chat.choices[0].message.refusal).toBe("I cannot help")
    expect(chat.choices[0].finish_reason).toBe("content_filter")
    const anthropic = translateToAnthropic(chat)
    expect(anthropic.content).toEqual([{ type: "text", text: "I cannot help" }])
    expect(anthropic.stop_reason).toBe("refusal")
  })

  it("preserves ordinary text before refusal text", () => {
    const chat = translateResponsesNonStreaming({
      id: "resp_mixed",
      object: "response",
      model: "gpt-test",
      output: [
        {
          type: "message",
          role: "assistant",
          content: [
            { type: "output_text", text: "ordinary" },
            { type: "refusal", refusal: "cannot continue" },
          ],
        },
      ],
    } as unknown as ResponsesResponse)
    expect(chat.choices[0].message).toMatchObject({
      content: "ordinary",
      refusal: "cannot continue",
    })
    expect(translateToAnthropic(chat).content).toEqual([
      { type: "text", text: "ordinary" },
      { type: "text", text: "cannot continue" },
    ])
  })
})
