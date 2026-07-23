import { describe, expect, it } from "bun:test"

import { HTTPError } from "~/lib/error"
import { translateRequestToResponses } from "~/services/copilot/create-responses"

describe("translateRequestToResponses tool call IDs", () => {
  it("preserves valid tool call IDs without emitting an empty item id", () => {
    const result = translateRequestToResponses({
      model: "gpt-5.6-sol",
      messages: [
        {
          role: "assistant",
          content: null,
          tool_calls: [
            {
              id: "toolu_123",
              type: "function",
              function: { name: "read_file", arguments: "{}" },
            },
          ],
        },
        { role: "tool", tool_call_id: "toolu_123", content: "result" },
      ],
    })

    expect(result.input).toEqual([
      {
        type: "function_call",
        name: "read_file",
        arguments: "{}",
        call_id: "toolu_123",
      },
      {
        type: "function_call_output",
        call_id: "toolu_123",
        output: "result",
      },
    ])
    expect(result.input.every((item) => !("id" in item))).toBe(true)
  })

  it("rejects an empty assistant tool call ID before forwarding", () => {
    expect(() =>
      translateRequestToResponses({
        model: "gpt-5.6-sol",
        messages: [
          {
            role: "assistant",
            content: null,
            tool_calls: [
              {
                id: "",
                type: "function",
                function: { name: "read_file", arguments: "{}" },
              },
            ],
          },
        ],
      }),
    ).toThrow(HTTPError)
  })

  it("rejects an empty tool result ID before forwarding", () => {
    expect(() =>
      translateRequestToResponses({
        model: "gpt-5.6-sol",
        messages: [{ role: "tool", tool_call_id: "", content: "result" }],
      }),
    ).toThrow(HTTPError)
  })
})
