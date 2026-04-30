import type { Context } from "hono"
import type { ContentfulStatusCode } from "hono/utils/http-status"

import consola from "consola"

export class HTTPError extends Error {
  response: Response

  constructor(message: string, response: Response) {
    super(message)
    this.response = response
  }
}

export function badRequest(message: string): HTTPError {
  return new HTTPError(
    message,
    new Response(
      JSON.stringify({
        error: { type: "invalid_request_error", message },
      }),
      {
        status: 400,
        headers: { "content-type": "application/json" },
      },
    ),
  )
}

function isUpstreamErrorEnvelope(
  value: unknown,
): value is { error: { message: string; type?: string; code?: string } } {
  if (!value || typeof value !== "object") return false
  const inner = (value as { error?: unknown }).error
  if (!inner || typeof inner !== "object") return false
  const message = (inner as { message?: unknown }).message
  return typeof message === "string"
}

export async function forwardError(c: Context, error: unknown) {
  consola.error("Error occurred:", error)

  if (error instanceof HTTPError) {
    const errorText = await error.response.text()
    let errorJson: unknown
    try {
      errorJson = JSON.parse(errorText)
    } catch {
      errorJson = errorText
    }
    consola.error("HTTP error:", errorJson)

    const status = error.response.status as ContentfulStatusCode

    if (isUpstreamErrorEnvelope(errorJson)) {
      return c.json(errorJson, status)
    }

    return c.json(
      {
        error: {
          message: typeof errorJson === "string" ? errorJson : errorText,
          type: "error",
        },
      },
      status,
    )
  }

  return c.json(
    {
      error: {
        message: (error as Error).message,
        type: "error",
      },
    },
    500,
  )
}
