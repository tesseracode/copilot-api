import { describe, expect, it, spyOn } from "bun:test"
import consola from "consola"
import { Hono } from "hono"
import { inspect } from "node:util"

import { forwardAnthropicError, forwardError, HTTPError } from "~/lib/error"

const SECRET = "SECRET_SENTINEL_7f3c9a"

async function call(
  protocol: "openai" | "anthropic",
  error: unknown,
): Promise<{ response: Response; logs: string }> {
  const app = new Hono()
  const logs: Array<Array<unknown>> = []
  const log = spyOn(consola, "error")
  const capture = ((...args: Array<unknown>) => {
    logs.push(args)
  }) as typeof consola.error
  log.mockImplementation(capture)
  app.get("/", (c) =>
    protocol === "openai" ?
      forwardError(c, error)
    : forwardAnthropicError(c, error),
  )
  const response = await app.request("/")
  log.mockRestore()
  return { response, logs: inspect(logs, { depth: 8 }) }
}

function httpError(
  status: number,
  body: string,
  headers: Record<string, string> = {},
): HTTPError {
  return new HTTPError("upstream", new Response(body, { status, headers }))
}

describe.each(["openai", "anthropic"] as const)(
  "%s non-stream error normalization",
  (protocol) => {
    it("redacts local Error and object messages from response and logs", async () => {
      for (const error of [
        new Error(`internal ${SECRET}`),
        { message: `object ${SECRET}`, secret: SECRET },
      ]) {
        const { response, logs } = await call(protocol, error)
        const text = await response.text()
        expect(response.status).toBe(500)
        expect(text).not.toContain(SECRET)
        expect(text).toContain("An unexpected error occurred.")
        expect(logs).not.toContain(SECRET)
      }
    })

    it("normalizes arbitrary thrown values to a non-empty message", async () => {
      for (const error of [`string ${SECRET}`, { secret: SECRET }]) {
        const { response, logs } = await call(protocol, error)
        const body = (await response.json()) as Record<string, unknown>
        const outer = body.error as Record<string, unknown>
        const nested =
          outer.error && typeof outer.error === "object" ?
            (outer.error as Record<string, unknown>)
          : outer
        expect(nested.message).toBe("An unexpected error occurred.")
        expect(logs).not.toContain(SECRET)
      }
    })

    it("redacts unrecognized upstream bodies", async () => {
      const { response, logs } = await call(
        protocol,
        httpError(500, `provider ${SECRET}`),
      )
      const text = await response.text()
      expect(response.status).toBe(500)
      expect(text).not.toContain(SECRET)
      expect(text).toContain("An unexpected upstream error occurred.")
      expect(logs).not.toContain(SECRET)
    })

    it("maps a local AbortError to a redacted 499 fallback", async () => {
      const error = new Error("This operation was aborted")
      error.name = "AbortError"
      const { response } = await call(protocol, error)
      const text = await response.text()
      expect(response.status).toBe(499)
      expect(text).toContain("Client closed request.")
      expect(text).not.toContain("This operation was aborted")
    })

    it("preserves safe provider metadata headers", async () => {
      const { response } = await call(
        protocol,
        httpError(429, "Too Many Requests", {
          "x-copilot-service-request-id": "copilot-request",
          "x-github-request-id": "github-request",
          "x-request-id": "generic-request",
          "retry-after": "30",
          "x-ratelimit-limit": "100",
          "x-ratelimit-remaining": "0",
          "x-ratelimit-reset": "999",
          authorization: SECRET,
        }),
      )

      expect(response.status).toBe(429)
      expect(response.headers.get("x-copilot-service-request-id")).toBe(
        "copilot-request",
      )
      expect(response.headers.get("x-github-request-id")).toBe("github-request")
      expect(response.headers.get("x-request-id")).toBe("generic-request")
      expect(response.headers.get("retry-after")).toBe("30")
      expect(response.headers.get("x-ratelimit-limit")).toBe("100")
      expect(response.headers.get("x-ratelimit-remaining")).toBe("0")
      expect(response.headers.get("x-ratelimit-reset")).toBe("999")
      expect(response.headers.get("authorization")).toBeNull()
    })
  },
)

describe("recognized error envelope preservation", () => {
  it("preserves a structured OpenAI error", async () => {
    const envelope = {
      error: {
        type: "invalid_request_error",
        code: "bad_input",
        message: "Invalid field",
        param: "model",
      },
    }
    const { response } = await call(
      "openai",
      httpError(400, JSON.stringify(envelope), {
        "content-type": "application/json",
      }),
    )
    expect(response.status).toBe(400)
    expect(await response.json()).toEqual(envelope)
  })

  it("preserves a native Anthropic error and request_id", async () => {
    const envelope = {
      type: "error",
      error: { type: "authentication_error", message: "Token expired" },
      request_id: "req_123",
    }
    const { response } = await call(
      "anthropic",
      httpError(401, JSON.stringify(envelope), {
        "content-type": "application/json",
      }),
    )
    expect(response.status).toBe(401)
    expect(await response.json()).toEqual(envelope)
  })
})
