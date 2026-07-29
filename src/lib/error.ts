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
    Response.json(
      { error: { type: "invalid_request_error", message } },
      { status: 400 },
    ),
  )
}

interface ErrorEnvelope {
  error: {
    message: string
    type?: string
    code?: string | null
    param?: string | null
  }
  [key: string]: unknown
}

interface AnthropicErrorEnvelope {
  type: "error"
  error: { type: string; message: string }
  request_id?: string
}

interface NormalizedHTTPError {
  status: ContentfulStatusCode
  body: unknown
  structured: ErrorEnvelope | AnthropicErrorEnvelope | undefined
  requestId: string | undefined
}

const SAFE_ERROR_HEADERS = [
  "x-copilot-service-request-id",
  "x-github-request-id",
  "x-request-id",
  "retry-after",
  "x-ratelimit-limit",
  "x-ratelimit-remaining",
  "x-ratelimit-reset",
] as const

const LOCAL_ERROR_MESSAGE = "An unexpected error occurred."
const ABORT_ERROR_MESSAGE = "Client closed request."

function isErrorEnvelope(value: unknown): value is ErrorEnvelope {
  if (!value || typeof value !== "object") return false
  const nested = (value as { error?: unknown }).error
  if (!nested || typeof nested !== "object") return false
  return typeof (nested as { message?: unknown }).message === "string"
}

function isAnthropicEnvelope(value: unknown): value is AnthropicErrorEnvelope {
  if (!value || typeof value !== "object") return false
  const record = value as { type?: unknown; error?: unknown }
  if (
    record.type !== "error"
    || !record.error
    || typeof record.error !== "object"
  ) {
    return false
  }
  const nested = record.error as { type?: unknown; message?: unknown }
  return typeof nested.type === "string" && typeof nested.message === "string"
}

function typeForStatus(status: number): string {
  if (status === 400) return "invalid_request_error"
  if (status === 401) return "authentication_error"
  if (status === 403) return "permission_error"
  if (status === 404) return "not_found_error"
  if (status === 409) return "conflict_error"
  if (status === 429) return "rate_limit_error"
  return "api_error"
}

function messageForStatus(status: number): string {
  if (status === 400) return "Invalid request."
  if (status === 401) return "Authentication failed."
  if (status === 403) return "Permission denied."
  if (status === 404) return "Resource not found."
  if (status === 409) return "Request conflict."
  if (status === 429) return "Rate limit exceeded."
  return "An unexpected upstream error occurred."
}

function copySafeHeaders(c: Context, response: Response): void {
  for (const name of SAFE_ERROR_HEADERS) {
    const value = response.headers.get(name)
    if (value) c.header(name, value)
  }
}

function responseRequestId(response: Response): string | undefined {
  return (
    response.headers.get("x-copilot-service-request-id")
    ?? response.headers.get("x-github-request-id")
    ?? response.headers.get("x-request-id")
    ?? undefined
  )
}

async function normalizeHTTPError(
  c: Context,
  error: HTTPError,
): Promise<NormalizedHTTPError> {
  const response = error.response
  copySafeHeaders(c, response)
  let parsed: unknown
  try {
    parsed = JSON.parse(await response.clone().text())
  } catch {
    parsed = undefined
  }
  const structured =
    isAnthropicEnvelope(parsed) || isErrorEnvelope(parsed) ? parsed : undefined
  return {
    status: response.status as ContentfulStatusCode,
    body: structured,
    structured,
    requestId:
      (isAnthropicEnvelope(structured) ? structured.request_id : undefined)
      ?? responseRequestId(response),
  }
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError"
}

function logUnexpected(error: unknown): void {
  const kind = error instanceof Error ? error.name : typeof error
  consola.error(`Unexpected non-stream error (${kind})`)
}

function logHTTPFailure(
  status: number,
  requestId: string | undefined,
  structured: ErrorEnvelope | AnthropicErrorEnvelope | undefined,
): void {
  const type =
    isAnthropicEnvelope(structured) ?
      structured.error.type
    : (structured?.error.type ?? structured?.error.code)
  consola.error(
    `Upstream non-stream error (status=${status}${type ? `, type=${type}` : ""}${requestId ? `, request_id=${requestId}` : ""})`,
  )
}

export async function forwardError(c: Context, error: unknown) {
  if (error instanceof HTTPError) {
    const normalized = await normalizeHTTPError(c, error)
    logHTTPFailure(
      normalized.status,
      normalized.requestId,
      normalized.structured,
    )
    if (isErrorEnvelope(normalized.structured)) {
      return c.json(normalized.structured, normalized.status)
    }
    if (isAnthropicEnvelope(normalized.structured)) {
      return c.json(
        {
          error: {
            type: normalized.structured.error.type,
            code: null,
            message: normalized.structured.error.message,
            param: null,
          },
        },
        normalized.status,
      )
    }
    return c.json(
      {
        error: {
          type: "upstream_error",
          code: "upstream_error",
          message: messageForStatus(normalized.status),
          param: null,
        },
      },
      normalized.status,
    )
  }

  if (isAbortError(error)) {
    consola.debug("Non-stream request aborted by client")
    return c.json(
      {
        error: {
          type: "request_aborted",
          code: "request_aborted",
          message: ABORT_ERROR_MESSAGE,
          param: null,
        },
      },
      499 as ContentfulStatusCode,
    )
  }

  logUnexpected(error)
  return c.json(
    {
      error: {
        type: "server_error",
        code: "internal_error",
        message: LOCAL_ERROR_MESSAGE,
        param: null,
      },
    },
    500,
  )
}

export async function forwardAnthropicError(c: Context, error: unknown) {
  if (error instanceof HTTPError) {
    const normalized = await normalizeHTTPError(c, error)
    logHTTPFailure(
      normalized.status,
      normalized.requestId,
      normalized.structured,
    )
    if (isAnthropicEnvelope(normalized.structured)) {
      return c.json(normalized.structured, normalized.status)
    }
    if (isErrorEnvelope(normalized.structured)) {
      return c.json(
        {
          type: "error" as const,
          error: {
            type:
              normalized.structured.error.type
              ?? typeForStatus(normalized.status),
            message: normalized.structured.error.message,
          },
        },
        normalized.status,
      )
    }
    return c.json(
      {
        type: "error" as const,
        error: {
          type: typeForStatus(normalized.status),
          message: messageForStatus(normalized.status),
        },
      },
      normalized.status,
    )
  }

  if (isAbortError(error)) {
    consola.debug("Anthropic non-stream request aborted by client")
    return c.json(
      {
        type: "error" as const,
        error: { type: "api_error", message: ABORT_ERROR_MESSAGE },
      },
      499 as ContentfulStatusCode,
    )
  }

  logUnexpected(error)
  return c.json(
    {
      type: "error" as const,
      error: { type: "api_error", message: LOCAL_ERROR_MESSAGE },
    },
    500,
  )
}
