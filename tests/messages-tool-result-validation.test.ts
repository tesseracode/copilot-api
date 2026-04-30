import { describe, expect, spyOn, test } from "bun:test"
import consola from "consola"

import { badRequest, forwardError, HTTPError } from "~/lib/error"
import { translateToOpenAI } from "~/routes/messages/non-stream-translation"
import { translateMessageContent } from "~/services/copilot/create-responses"

describe("translateMessageContent multimodal handling", () => {
  test("text part maps to input_text", () => {
    const out = translateMessageContent([{ type: "text", text: "hi" }])
    expect(out).toEqual([{ type: "input_text", text: "hi" }])
  })

  test("image_url part with url maps to input_image", () => {
    const out = translateMessageContent([
      {
        type: "image_url",
        image_url: { url: "https://example.com/x.png", detail: "low" },
      },
    ])
    expect(out).toEqual([
      {
        type: "input_image",
        image_url: "https://example.com/x.png",
        detail: "low",
      },
    ])
  })

  test("image_url part with empty url is dropped with warn", () => {
    const warnSpy = spyOn(consola, "warn").mockImplementation(() => {})
    try {
      const out = translateMessageContent([
        { type: "image_url", image_url: { url: "" } },
      ])
      expect(out).toEqual([])
      expect(warnSpy).toHaveBeenCalledTimes(1)
    } finally {
      warnSpy.mockRestore()
    }
  })

  test("input_audio part maps to input_audio with data and format", () => {
    const out = translateMessageContent([
      {
        type: "input_audio",
        input_audio: { data: "AAAA", format: "wav" },
      },
    ])
    expect(out).toEqual([
      {
        type: "input_audio",
        input_audio: { data: "AAAA", format: "wav" },
      },
    ])
  })

  test("unknown type is dropped with warn carrying the type label", () => {
    const warnSpy = spyOn(consola, "warn").mockImplementation(() => {})
    try {
      const out = translateMessageContent([{ type: "mystery_box", text: "" }])
      expect(out).toEqual([])
      expect(warnSpy).toHaveBeenCalledTimes(1)
      const call = warnSpy.mock.calls[0] as
        | [string, Record<string, unknown>]
        | undefined
      expect(call?.[1]).toMatchObject({ unknownType: "mystery_box" })
    } finally {
      warnSpy.mockRestore()
    }
  })
})

describe("empty tool_use_id rejected before upstream call", () => {
  test("throws badRequest with 400 and clean envelope", async () => {
    let thrown: unknown
    try {
      translateToOpenAI({
        model: "claude-test",
        max_tokens: 16,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "tool_result",
                tool_use_id: "",
                content: "hi",
              },
            ],
          },
        ],
      })
    } catch (err) {
      thrown = err
    }

    expect(thrown).toBeInstanceOf(HTTPError)
    const httpErr = thrown as HTTPError
    expect(httpErr.response.status).toBe(400)
    const body = (await httpErr.response.json()) as Record<string, unknown>
    expect(body).toEqual({
      error: {
        type: "invalid_request_error",
        message: "tool_result block is missing tool_use_id",
      },
    })
  })

  test("valid tool_use_id translates without throwing", () => {
    expect(() =>
      translateToOpenAI({
        model: "claude-test",
        max_tokens: 16,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "tool_result",
                tool_use_id: "toolu_abc",
                content: "hi",
              },
            ],
          },
        ],
      }),
    ).not.toThrow()
  })
})

describe("forwardError envelope handling", () => {
  type CapturedJson = { body: unknown; status: number }
  function makeMockContext() {
    const captured: { calls: Array<CapturedJson> } = { calls: [] }
    const c = {
      json(body: unknown, status: number) {
        captured.calls.push({ body, status })
        return new Response(JSON.stringify(body), { status })
      },
    } as unknown as Parameters<typeof forwardError>[0]
    return { c, captured }
  }

  test("upstream {error:{message}} envelope is passed through unchanged", async () => {
    const upstreamBody = {
      error: {
        type: "rate_limit_exceeded",
        message: "too many requests",
        code: "rate_limit",
      },
    }
    const httpErr = new HTTPError(
      "upstream",
      new Response(JSON.stringify(upstreamBody), {
        status: 429,
        headers: { "content-type": "application/json" },
      }),
    )
    const { c, captured } = makeMockContext()
    await forwardError(c, httpErr)
    expect(captured.calls).toHaveLength(1)
    expect(captured.calls[0]).toEqual({ body: upstreamBody, status: 429 })
  })

  test("upstream plain text body is wrapped in our envelope", async () => {
    const httpErr = new HTTPError(
      "upstream",
      new Response("not json", { status: 502 }),
    )
    const { c, captured } = makeMockContext()
    await forwardError(c, httpErr)
    expect(captured.calls).toHaveLength(1)
    expect(captured.calls[0]).toEqual({
      body: { error: { message: "not json", type: "error" } },
      status: 502,
    })
  })

  test("non-HTTPError errors are wrapped in 500 envelope", async () => {
    const { c, captured } = makeMockContext()
    await forwardError(c, new Error("boom"))
    expect(captured.calls).toHaveLength(1)
    expect(captured.calls[0]).toEqual({
      body: { error: { message: "boom", type: "error" } },
      status: 500,
    })
  })

  test("badRequest synthesises a clean 400 HTTPError", async () => {
    const err = badRequest("missing field")
    expect(err.response.status).toBe(400)
    const body = (await err.response.json()) as Record<string, unknown>
    expect(body).toEqual({
      error: { type: "invalid_request_error", message: "missing field" },
    })
  })
})
