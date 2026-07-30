import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test"

import type { ChatCompletionsPayload } from "~/services/copilot/create-chat-completions"

import { state } from "~/lib/state"
import { server } from "~/server"
import { translateRequestToResponses } from "~/services/copilot/create-responses"

const originalFetch = globalThis.fetch

beforeEach(() => {
  state.copilotToken = "test-token"
  state.models = {
    object: "list",
    data: [
      {
        id: "gpt-responses",
        name: "GPT Responses",
        object: "model",
        vendor: "openai",
        version: "1",
        preview: false,
        model_picker_enabled: true,
        supported_endpoints: ["/responses"],
        capabilities: {
          family: "gpt",
          limits: {},
          object: "model_capabilities",
          supports: { reasoning_effort: ["low"] },
          tokenizer: "test",
          type: "chat",
        },
      },
    ],
  }
})

afterEach(() => {
  globalThis.fetch = originalFetch
})

function translate(messages: ChatCompletionsPayload["messages"]) {
  return translateRequestToResponses({ model: "gpt-responses", messages }).input
}

describe("Responses instruction role preservation", () => {
  it("preserves system role", () => {
    expect(translate([{ role: "system", content: "system" }])).toEqual([
      { type: "message", role: "system", content: "system" },
    ])
  })

  it("preserves developer role", () => {
    expect(translate([{ role: "developer", content: "developer" }])).toEqual([
      { type: "message", role: "developer", content: "developer" },
    ])
  })

  it("preserves mixed role identity and order", () => {
    expect(
      translate([
        { role: "system", content: "s1" },
        { role: "developer", content: "d1" },
        { role: "user", content: "u1" },
        { role: "system", content: "s2" },
        { role: "developer", content: "d2" },
      ]),
    ).toEqual([
      { type: "message", role: "system", content: "s1" },
      { type: "message", role: "developer", content: "d1" },
      { type: "message", role: "user", content: "u1" },
      { type: "message", role: "system", content: "s2" },
      { type: "message", role: "developer", content: "d2" },
    ])
  })

  it("preserves roles in the routed upstream request", async () => {
    let upstream: Record<string, unknown> | undefined
    globalThis.fetch = mock(
      (_input: string | URL | Request, init?: RequestInit) => {
        if (typeof init?.body !== "string")
          throw new Error("Expected JSON body")
        upstream = JSON.parse(init.body) as Record<string, unknown>
        return Promise.resolve(
          Response.json({
            id: "resp_1",
            object: "response",
            model: "gpt-responses",
            output: [],
          }),
        )
      },
    ) as unknown as typeof fetch

    const response = await server.request("/v1/chat/completions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        model: "gpt-responses",
        messages: [
          { role: "system", content: "system" },
          { role: "developer", content: "developer" },
          { role: "user", content: "user" },
        ],
        reasoning_effort: "low",
      }),
    })

    expect(response.status).toBe(200)
    expect(upstream?.input).toEqual([
      { type: "message", role: "system", content: "system" },
      { type: "message", role: "developer", content: "developer" },
      { type: "message", role: "user", content: "user" },
    ])
  })
})
