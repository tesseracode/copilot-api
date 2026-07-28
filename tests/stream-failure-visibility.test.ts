import { describe, expect, it } from "bun:test"

import { wrapResponsesStream } from "~/lib/responses-stream-wrapper"

const encoder = new TextEncoder()

function throwingStream(firstChunk: string): ReadableStream<Uint8Array> {
  let sent = false
  return new ReadableStream({
    pull(controller) {
      if (!sent) {
        sent = true
        controller.enqueue(encoder.encode(firstChunk))
        return
      }
      controller.error(new Error("upstream exploded"))
    },
  })
}

describe("native Responses stream failure visibility", () => {
  it("preserves partial bytes then emits one terminal Responses error", async () => {
    const body = await new Response(
      wrapResponsesStream(
        throwingStream(
          'event: response.created\ndata: {"type":"response.created"}\n\n',
        ),
      ),
    ).text()

    expect(body).toContain("event: response.created")
    expect(body.match(/event: error/g)).toHaveLength(1)
    expect(body).toContain('"code":"stream_transport_error"')
    expect(body).toContain(
      '"message":"The upstream stream terminated unexpectedly."',
    )
  })

  it("actively cancels a pending upstream read on client abort", async () => {
    const controller = new AbortController()
    let cancelled = false
    const upstream = new ReadableStream<Uint8Array>({
      pull() {
        return new Promise(() => {})
      },
      cancel() {
        cancelled = true
      },
    })
    const reader = wrapResponsesStream(upstream, controller.signal).getReader()
    const pendingRead = reader.read()
    controller.abort()

    expect(await pendingRead).toEqual({ done: true, value: undefined })
    expect(cancelled).toBe(true)
  })

  it("does not duplicate an in-band error after transport failure", async () => {
    const body = await new Response(
      wrapResponsesStream(
        throwingStream(
          'event: error\ndata: {"type":"error","message":"provider failed"}\n\n',
        ),
      ),
    ).text()

    expect(body.match(/event: error/g)).toHaveLength(1)
    expect(body).toContain("provider failed")
    expect(body).not.toContain("stream_transport_error")
  })

  it("preserves successful bytes exactly", async () => {
    const expected = new Uint8Array([0, 1, 2, 127, 128, 255])
    const actual = new Uint8Array(
      await new Response(
        wrapResponsesStream(
          new ReadableStream({
            start(controller) {
              controller.enqueue(expected)
              controller.close()
            },
          }),
        ),
      ).arrayBuffer(),
    )

    expect(actual).toEqual(expected)
  })
})
