import { describe, expect, spyOn, test } from "bun:test"
import consola from "consola"

import type { ChatCompletionsPayload } from "~/services/copilot/create-chat-completions"

import { translateRequestToResponses } from "~/services/copilot/create-responses"

function payload(extra: Partial<ChatCompletionsPayload> = {}) {
  return {
    model: "gpt-5.4-mini",
    messages: [{ role: "user" as const, content: "hi" }],
    ...extra,
  } satisfies ChatCompletionsPayload
}

function translateCapturingWarnings(request: ChatCompletionsPayload) {
  const warn = spyOn(consola, "warn").mockImplementation(
    (() => undefined) as never,
  )
  const result = translateRequestToResponses(request)
  const messages = warn.mock.calls.map((call) => String(call[0]))
  warn.mockRestore()
  return { result, messages }
}

describe("dropped sampling parameters", () => {
  test("warns for a meaningful temperature", () => {
    const { messages } = translateCapturingWarnings(
      payload({ temperature: 0.2 }),
    )

    expect(messages).toHaveLength(1)
    expect(messages[0]).toContain("temperature=0.2")
    expect(messages[0]).toContain("gpt-5.4-mini")
  })

  test("warns for a meaningful top_p", () => {
    const { messages } = translateCapturingWarnings(payload({ top_p: 0.5 }))

    expect(messages).toHaveLength(1)
    expect(messages[0]).toContain("top_p=0.5")
  })

  test("names both parameters in a single warning", () => {
    const { messages } = translateCapturingWarnings(
      payload({ temperature: 0.2, top_p: 0.5 }),
    )

    expect(messages).toHaveLength(1)
    expect(messages[0]).toContain("temperature=0.2")
    expect(messages[0]).toContain("top_p=0.5")
  })

  const defaultValueCases: Array<[string, Partial<ChatCompletionsPayload>]> = [
    ["temperature of 1", { temperature: 1 }],
    ["top_p of 1", { top_p: 1 }],
    ["both defaults", { temperature: 1, top_p: 1 }],
  ]
  for (const [label, extra] of defaultValueCases) {
    test(`stays silent for ${label} because upstream accepts it`, () => {
      const { messages } = translateCapturingWarnings(payload(extra))

      expect(messages).toHaveLength(0)
    })
  }

  const emptyValueCases: Array<[string, null | undefined]> = [
    ["null", null],
    ["undefined", undefined],
  ]
  for (const [label, value] of emptyValueCases) {
    test(`stays silent for a ${label} temperature`, () => {
      const { messages } = translateCapturingWarnings(
        payload({ temperature: value }),
      )

      expect(messages).toHaveLength(0)
    })
  }

  test("stays silent when neither parameter is present", () => {
    const { messages } = translateCapturingWarnings(payload())

    expect(messages).toHaveLength(0)
  })

  test("never forwards the parameters regardless of value", () => {
    for (const extra of [
      { temperature: 0.2 },
      { top_p: 0.5 },
      { temperature: 1, top_p: 1 },
    ]) {
      const { result } = translateCapturingWarnings(payload(extra))
      expect(result).not.toHaveProperty("temperature")
      expect(result).not.toHaveProperty("top_p")
    }
  })

  test("leaves the rest of the translated payload intact", () => {
    const { result } = translateCapturingWarnings(
      payload({ temperature: 0.2, max_tokens: 64, stream: true }),
    )

    expect(result.model).toBe("gpt-5.4-mini")
    expect(result.max_output_tokens).toBe(64)
    expect(result.stream).toBe(true)
  })
})
