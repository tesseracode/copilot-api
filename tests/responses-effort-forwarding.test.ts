import { describe, expect, it } from "bun:test"

import { translateRequestToResponses } from "~/services/copilot/create-responses"

describe("translateRequestToResponses effort forwarding", () => {
  const basePayload = {
    model: "gpt-5.5",
    messages: [{ role: "user" as const, content: "hello" }],
  }

  it("populates reasoning.effort when effort is provided", () => {
    const result = translateRequestToResponses(basePayload, "xhigh")
    expect(result.reasoning).toEqual({ effort: "xhigh" })
  })

  it("populates reasoning.effort=high", () => {
    const result = translateRequestToResponses(basePayload, "high")
    expect(result.reasoning).toEqual({ effort: "high" })
  })

  it("omits reasoning when no effort is provided", () => {
    const result = translateRequestToResponses(basePayload)
    expect(result.reasoning).toBeUndefined()
  })

  it("omits reasoning when effort is undefined", () => {
    const result = translateRequestToResponses(basePayload, undefined)
    expect(result.reasoning).toBeUndefined()
  })
})
