import { describe, expect, it } from "bun:test"

import { normalizeCopilotUsage } from "~/lib/copilot-usage"
import { translateToAnthropic } from "~/routes/messages/non-stream-translation"
import { translateResponsesNonStreaming } from "~/services/copilot/create-responses"

const rawUsage = {
  token_details: [
    {
      batch_size: 1_000_000,
      cost_per_batch: 50_000_000_000,
      token_count: 32_000,
      token_type: "cache_read",
    },
    {
      batch_size: 1_000_000,
      cost_per_batch: 625_000_000_000,
      token_count: 100,
      token_type: "cache_write",
    },
  ],
  total_nano_aiu: 1_662_500_000,
}

describe("Copilot usage preservation", () => {
  it("normalizes AI credits and cache evidence", () => {
    expect(normalizeCopilotUsage(rawUsage)).toMatchObject({
      total_ai_credits: 1.6625,
      cache: { read_tokens: 32_000, write_tokens: 100, hit: true },
    })
  })

  it("preserves usage through Responses to Chat translation", () => {
    const chat = translateResponsesNonStreaming({
      id: "resp_1",
      object: "response",
      model: "gpt-5.6-sol",
      output: [
        {
          type: "message",
          role: "assistant",
          content: [{ type: "output_text", text: "hello" }],
        },
      ],
      usage: { input_tokens: 10, output_tokens: 2, total_tokens: 12 },
      copilot_usage: rawUsage,
    })

    expect(chat.copilot_usage?.total_ai_credits).toBe(1.6625)
    expect(chat.copilot_usage?.cache.hit).toBe(true)
  })

  it("preserves usage through Chat to Anthropic translation", () => {
    const anthropic = translateToAnthropic({
      id: "chat_1",
      object: "chat.completion",
      created: 0,
      model: "gpt-5.6-sol",
      choices: [
        {
          index: 0,
          message: { role: "assistant", content: "hello" },
          logprobs: null,
          finish_reason: "stop",
        },
      ],
      copilot_usage: normalizeCopilotUsage(rawUsage),
      usage: { prompt_tokens: 10, completion_tokens: 2, total_tokens: 12 },
    })

    expect(anthropic.copilot_usage?.cache.read_tokens).toBe(32_000)
    expect(anthropic.usage).toEqual({ input_tokens: 10, output_tokens: 2 })
  })
})
