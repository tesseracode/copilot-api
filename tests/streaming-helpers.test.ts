/**
 * Unit coverage for src/lib/streaming.ts.
 *
 * These exist because the route-level tests in
 * tests/streaming-abort-handling.test.ts cannot distinguish a swallowed abort
 * from a rethrown one: by the time either happens the response headers are
 * already sent, so both end as HTTP 200 with a partial body and a clean EOF.
 * A mutation that forced isClientAbort to return false left every one of those
 * route tests passing. The logic therefore has to be pinned here, directly.
 */
import { describe, expect, it } from "bun:test"

import { isClientAbort, isNonStreaming } from "~/lib/streaming"

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

  it("is false for an ordinary error with no signal", () => {
    expect(isClientAbort(new Error("upstream exploded"))).toBe(false)
  })

  it("is false for a non-Error thrown value", () => {
    expect(isClientAbort("just a string")).toBe(false)
    expect(isClientAbort(undefined)).toBe(false)
  })
})

describe("isNonStreaming", () => {
  it("treats a plain response object as non-streaming", () => {
    expect(isNonStreaming({ id: "c1", choices: [] })).toBe(true)
  })

  it("treats an async generator as streaming", () => {
    expect(isNonStreaming(oneValue())).toBe(false)
  })

  it("treats any async iterable as streaming, even without a choices field", () => {
    const iterable = { [Symbol.asyncIterator]: oneValue }
    expect(isNonStreaming(iterable)).toBe(false)
  })

  it("does not depend on a choices property", () => {
    // The previous implementation asked whether the value had an own `choices`
    // property, which only worked because the iterator returned by events()
    // happens not to expose one (POTENTIAL_FEATURES.md #3). An async iterable
    // that did carry `choices` would have been misclassified as non-streaming.
    const streamingWithChoices = {
      choices: [],
      [Symbol.asyncIterator]: oneValue,
    }
    expect(isNonStreaming(streamingWithChoices)).toBe(false)

    // And a plain object without `choices` is still non-streaming.
    expect(isNonStreaming({ id: "resp_1", output: [] })).toBe(true)
  })
})
