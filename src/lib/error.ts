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

/**
 * Anthropic error types, keyed by the HTTP status that implies them.
 *
 * Used when the upstream body carries no usable type of its own — most often
 * when it is not JSON at all, in which case a plain-text 401 would otherwise be
 * indistinguishable from a rate limit.
 */
const ANTHROPIC_ERROR_TYPE_BY_STATUS: Record<number, string> = {
  400: "invalid_request_error",
  401: "authentication_error",
  403: "permission_error",
  404: "not_found_error",
  413: "request_too_large",
  429: "rate_limit_error",
}

function anthropicErrorType(status: number): string {
  return ANTHROPIC_ERROR_TYPE_BY_STATUS[status] ?? "api_error"
}

/** An Anthropic error body already has a top-level `type: "error"`. */
function isAnthropicErrorEnvelope(
  value: unknown,
): value is { type: "error"; error: { type: string; message: string } } {
  if (!isUpstreamErrorEnvelope(value)) return false
  return (value as { type?: unknown }).type === "error"
}

/**
 * Forward an error to an Anthropic-shaped client.
 *
 * `/v1/messages` speaks the Anthropic contract, whose errors carry a top-level
 * `type: "error"` alongside the nested error object — see `AnthropicErrorEvent`
 * and `translateErrorToAnthropicErrorEvent`, which the streaming path on this
 * same route already emits. `forwardError` produces the OpenAI envelope, so
 * routing Anthropic errors through it made the endpoint return one shape for
 * upstream rejections (passed through intact) and another for anything the
 * proxy raised itself.
 *
 * An upstream body that is already Anthropic-shaped is forwarded untouched, so
 * fields like `request_id` survive.
 */
export async function forwardAnthropicError(c: Context, error: unknown) {
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

    if (isAnthropicErrorEnvelope(errorJson)) {
      return c.json(errorJson, status)
    }

    if (isUpstreamErrorEnvelope(errorJson)) {
      return c.json(
        {
          type: "error",
          error: {
            type: errorJson.error.type ?? anthropicErrorType(status),
            message: errorJson.error.message,
          },
        },
        status,
      )
    }

    return c.json(
      {
        type: "error",
        error: {
          type: anthropicErrorType(status),
          message: typeof errorJson === "string" ? errorJson : errorText,
        },
      },
      status,
    )
  }

  return c.json(
    {
      type: "error",
      error: {
        type: "api_error",
        message: (error as Error).message,
      },
    },
    500,
  )
}
