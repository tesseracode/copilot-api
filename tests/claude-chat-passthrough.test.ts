import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test"

import type { ModelsResponse } from "~/services/copilot/get-models"

import { state } from "~/lib/state"
import { server } from "~/server"

const originalFetch = globalThis.fetch
const originalModels = state.models
const originalToken = state.copilotToken
const originalManualApprove = state.manualApprove

/**
 * Claude model that advertises /v1/messages, so resolveEndpoint still reports
 * /v1/messages for it. The point of these tests is that /chat/completions does
 * NOT act on that — it forwards upstream instead of rerouting.
 */
const claudeCatalog = {
  object: "list",
  data: [
    {
      id: "claude-sonnet-5",
      name: "Claude Sonnet 5",
      object: "model",
      vendor: "anthropic",
      version: "1",
      preview: false,
      model_picker_enabled: true,
      supported_endpoints: ["/v1/messages", "/chat/completions"],
      capabilities: {
        family: "claude-sonnet-5",
        limits: { max_output_tokens: 64000 },
        object: "model_capabilities",
        supports: { tool_calls: true },
        tokenizer: "o200k_base",
        type: "chat",
      },
    },
  ],
} as unknown as ModelsResponse

/** Mirrors the tool-call deltas upstream /chat/completions emits for Claude. */
const upstreamToolCallSse = [
  `data: {"id":"c1","object":"chat.completion.chunk","created":1,"model":"claude-sonnet-5","choices":[{"index":0,"delta":{"role":"assistant","content":""},"finish_reason":null}]}`,
  `data: {"id":"c1","object":"chat.completion.chunk","created":1,"model":"claude-sonnet-5","choices":[{"index":0,"delta":{"tool_calls":[{"index":0,"id":"toolu_abc","type":"function","function":{"name":"get_weather"}}]},"finish_reason":null}]}`,
  `data: {"id":"c1","object":"chat.completion.chunk","created":1,"model":"claude-sonnet-5","choices":[{"index":0,"delta":{"tool_calls":[{"index":0,"function":{"arguments":"{\\"city\\""}}]},"finish_reason":null}]}`,
  `data: {"id":"c1","object":"chat.completion.chunk","created":1,"model":"claude-sonnet-5","choices":[{"index":0,"delta":{"tool_calls":[{"index":0,"function":{"arguments":": \\"Paris\\"}"}}]},"finish_reason":null}]}`,
  `data: {"id":"c1","object":"chat.completion.chunk","created":1,"model":"claude-sonnet-5","choices":[{"index":0,"delta":{},"finish_reason":"tool_calls"}]}`,
  `data: [DONE]`,
].join("\n\n")

interface EmittedToolCall {
  index: number
  id?: string
  function?: { name?: string; arguments?: string }
}

function collectToolCalls(sseBody: string): Array<EmittedToolCall> {
  const collected: Array<EmittedToolCall> = []
  for (const line of sseBody.split("\n")) {
    if (!line.startsWith("data:")) continue
    const payload = line.slice(5).trim()
    if (!payload || payload === "[DONE]") continue
    const chunk = JSON.parse(payload) as {
      choices?: Array<{ delta?: { tool_calls?: Array<EmittedToolCall> } }>
    }
    for (const toolCall of chunk.choices?.[0]?.delta?.tool_calls ?? []) {
      collected.push(toolCall)
    }
  }
  return collected
}

function requestUrlOf(input: string | URL | Request): string {
  if (typeof input === "string") return input
  if (input instanceof URL) return input.href
  return input.url
}

beforeEach(() => {
  state.copilotToken = "test-token"
  state.manualApprove = false
  state.models = claudeCatalog
})

afterEach(() => {
  globalThis.fetch = originalFetch
  state.models = originalModels
  state.copilotToken = originalToken
  state.manualApprove = originalManualApprove
})

describe("Claude on /chat/completions passes through to upstream", () => {
  it("forwards to upstream /chat/completions instead of rerouting to /v1/messages", async () => {
    let requestedUrl = ""
    globalThis.fetch = mock((input: string | URL | Request) => {
      requestedUrl = requestUrlOf(input)
      return Promise.resolve(
        Response.json({
          id: "c1",
          object: "chat.completion",
          created: 1,
          model: "claude-sonnet-5",
          choices: [
            {
              index: 0,
              message: {
                role: "assistant",
                content: null,
                tool_calls: [
                  {
                    id: "toolu_abc",
                    type: "function",
                    function: {
                      name: "get_weather",
                      arguments: '{"city":"Paris"}',
                    },
                  },
                ],
              },
              logprobs: null,
              finish_reason: "tool_calls",
            },
          ],
        }),
      )
    }) as unknown as typeof fetch

    const response = await server.request("/v1/chat/completions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        model: "claude-sonnet-5",
        max_tokens: 256,
        messages: [{ role: "user", content: "Weather in Paris?" }],
      }),
    })

    expect(response.status).toBe(200)
    expect(requestedUrl).toEndWith("/chat/completions")
    expect(requestedUrl).not.toContain("/v1/messages")

    // Non-streaming tool calls arrive in OpenAI shape, untranslated.
    const body = (await response.json()) as {
      choices: Array<{
        finish_reason: string
        message: { tool_calls?: Array<{ function: { name: string } }> }
      }>
    }
    expect(body.choices[0].finish_reason).toBe("tool_calls")
    expect(body.choices[0].message.tool_calls?.[0].function.name).toBe(
      "get_weather",
    )
  })

  it("preserves streaming tool call deltas", async () => {
    globalThis.fetch = mock(() =>
      Promise.resolve(
        new Response(upstreamToolCallSse, {
          headers: { "content-type": "text/event-stream" },
        }),
      ),
    ) as unknown as typeof fetch

    const response = await server.request("/v1/chat/completions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        model: "claude-sonnet-5",
        max_tokens: 256,
        stream: true,
        messages: [{ role: "user", content: "Weather in Paris?" }],
        tools: [
          {
            type: "function",
            function: {
              name: "get_weather",
              parameters: {
                type: "object",
                properties: { city: { type: "string" } },
                required: ["city"],
              },
            },
          },
        ],
      }),
    })

    expect(response.status).toBe(200)
    const toolCalls = collectToolCalls(await response.text())

    // The reroute emitted a single {"delta":{},"finish_reason":"tool_calls"}
    // chunk, losing the name, id and arguments entirely.
    expect(toolCalls.length).toBeGreaterThan(0)
    expect(toolCalls[0].id).toBe("toolu_abc")
    expect(toolCalls[0].function?.name).toBe("get_weather")

    const args = toolCalls
      .map((toolCall) => toolCall.function?.arguments ?? "")
      .join("")
    expect(args).toBe('{"city": "Paris"}')
    expect(JSON.parse(args)).toEqual({ city: "Paris" })
  })
})
