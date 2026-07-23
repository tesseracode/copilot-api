import { describe, expect, it } from "bun:test"

import {
  openaiToAnthropicPayload,
  translateToOpenAI,
} from "~/routes/messages/non-stream-translation"

describe("effort translation", () => {
  it("preserves Anthropic effort in the OpenAI intermediate payload", () => {
    const result = translateToOpenAI({
      model: "gpt-5.6-sol",
      messages: [{ role: "user", content: "hello" }],
      max_tokens: 64,
      output_config: { effort: "max" },
    })

    expect(result.reasoning_effort).toBe("max")
  })

  it("preserves OpenAI effort when rerouting Claude to native messages", () => {
    const result = openaiToAnthropicPayload({
      model: "claude-opus-4.7",
      messages: [{ role: "user", content: "hello" }],
      reasoning_effort: "xhigh",
    })

    expect(result.output_config).toEqual({ effort: "xhigh" })
  })
})
