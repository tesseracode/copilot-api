import { describe, expect, it } from "bun:test"

import { isClientAbort, STREAM_TRANSPORT_ERROR } from "~/lib/streaming"

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

describe("terminal stream error contract", () => {
  it("uses a stable client-safe error instead of exposing exceptions", () => {
    expect(STREAM_TRANSPORT_ERROR).toEqual({
      type: "api_error",
      code: "stream_transport_error",
      message: "The upstream stream terminated unexpectedly.",
    })
  })
})
