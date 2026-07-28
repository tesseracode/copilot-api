import { describe, expect, it } from "bun:test"

import {
  isClientAbort,
  isNonStreaming,
  STREAM_TRANSPORT_ERROR,
} from "~/lib/streaming"

async function* oneValue() {
  yield await Promise.resolve(1)
}

describe("isClientAbort", () => {
  it("is true when the request signal is already aborted", () => {
    const controller = new AbortController()
    controller.abort()
    expect(isClientAbort(new Error("anything"), controller.signal)).toBe(true)
  })

  it("is true for an AbortError even without a signal", () => {
    const error = new Error("The operation was aborted")
    error.name = "AbortError"
    expect(isClientAbort(error)).toBe(true)
  })

  it("is false for an ordinary error on a live signal", () => {
    const controller = new AbortController()
    expect(
      isClientAbort(new Error("upstream exploded"), controller.signal),
    ).toBe(false)
  })

  it("is false for ordinary and non-Error values without a signal", () => {
    expect(isClientAbort(new Error("upstream exploded"))).toBe(false)
    expect(isClientAbort("just a string")).toBe(false)
    expect(isClientAbort(undefined)).toBe(false)
  })
})

describe("isNonStreaming", () => {
  it("treats a plain response object as non-streaming", () => {
    expect(isNonStreaming({ id: "c1", choices: [] })).toBe(true)
    expect(isNonStreaming({ id: "resp_1", output: [] })).toBe(true)
  })

  it("treats async iterables as streaming regardless of choices", () => {
    expect(isNonStreaming(oneValue())).toBe(false)
    expect(
      isNonStreaming({ choices: [], [Symbol.asyncIterator]: oneValue }),
    ).toBe(false)
  })
})

describe("terminal stream error contract", () => {
  it("uses a stable client-safe error instead of exposing exceptions", () => {
    expect(STREAM_TRANSPORT_ERROR).toEqual({
      type: "api_error",
      code: "stream_transport_error",
      message: "The upstream stream terminated unexpectedly.",
    })
  })
})
