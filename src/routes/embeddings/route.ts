import type { ContentfulStatusCode } from "hono/utils/http-status"

import { Hono } from "hono"

import { state } from "~/lib/state"
import {
  createEmbeddings,
  type EmbeddingRequest,
} from "~/services/copilot/create-embeddings"

export const embeddingRoutes = new Hono()

type ErrorBody = ReturnType<typeof errorResponse>
type ValidationResult = { payload: EmbeddingRequest } | { error: ErrorBody }

function errorResponse(
  message: string,
  param: string | null,
  code = "invalid_value",
) {
  return { error: { type: "invalid_request_error", code, message, param } }
}

function validateInput(value: unknown): Array<string> | ErrorBody {
  const values = typeof value === "string" ? [value] : value
  if (
    !Array.isArray(values)
    || values.length === 0
    || values.some((item) => typeof item !== "string" || item.length === 0)
  ) {
    return errorResponse(
      "input must be a non-empty string or array of non-empty strings",
      "input",
    )
  }
  return values as Array<string>
}

function validateOptions(
  input: Record<string, unknown>,
  values: Array<string>,
): ErrorBody | undefined {
  const model = state.models?.data.find((item) => item.id === input.model)
  if (!model || model.capabilities.type !== "embeddings") {
    return errorResponse(
      `Model ${String(input.model)} is not an available embedding model`,
      "model",
      "model_not_found",
    )
  }
  const maxInputs = model.capabilities.limits.max_inputs
  if (maxInputs && values.length > maxInputs) {
    return errorResponse(
      `input contains ${values.length} items; model limit is ${maxInputs}`,
      "input",
    )
  }
  if (
    input.dimensions !== undefined
    && (!Number.isInteger(input.dimensions) || Number(input.dimensions) <= 0)
  ) {
    return errorResponse("dimensions must be a positive integer", "dimensions")
  }
  if (
    input.dimensions !== undefined
    && !model.capabilities.supports.dimensions
  ) {
    return errorResponse(
      `Model ${String(input.model)} does not support dimensions`,
      "dimensions",
    )
  }
  if (
    input.encoding_format !== undefined
    && input.encoding_format !== "float"
  ) {
    return errorResponse(
      'encoding_format must be "float"; base64 is not supported',
      "encoding_format",
    )
  }
}

function validatePayload(value: unknown): ValidationResult {
  if (!value || typeof value !== "object") {
    return { error: errorResponse("Request body must be an object", null) }
  }
  const input = value as Record<string, unknown>
  if (typeof input.model !== "string" || input.model.length === 0) {
    return { error: errorResponse("model must be a non-empty string", "model") }
  }
  const values = validateInput(input.input)
  if (!Array.isArray(values)) return { error: values }
  const optionsError = validateOptions(input, values)
  if (optionsError) return { error: optionsError }

  return {
    payload: {
      model: input.model,
      input: values,
      dimensions: input.dimensions as number | undefined,
      encoding_format: input.encoding_format as "float" | undefined,
    },
  }
}

function copySafeHeaders(
  response: Response,
  set: (name: string, value: string) => void,
) {
  for (const name of [
    "x-copilot-service-request-id",
    "x-github-request-id",
    "retry-after",
  ]) {
    const value = response.headers.get(name)
    if (value) set(name, value)
  }
}

async function upstreamError(response: Response): Promise<ErrorBody> {
  const text = await response.text()
  let envelope: Record<string, unknown> | undefined
  try {
    const parsed = JSON.parse(text) as { error?: Record<string, unknown> }
    envelope = parsed.error
  } catch {
    envelope = undefined
  }
  return {
    error: {
      type:
        typeof envelope?.type === "string" ? envelope.type : "upstream_error",
      code:
        typeof envelope?.code === "string" ?
          envelope.code
        : "embedding_request_failed",
      message:
        typeof envelope?.message === "string" ?
          envelope.message
        : text.trim()
          || `Upstream embeddings request failed (${response.status})`,
      param: typeof envelope?.param === "string" ? envelope.param : null,
    },
  }
}

embeddingRoutes.post("/", async (c) => {
  let value: unknown
  try {
    value = await c.req.json()
  } catch {
    return c.json(errorResponse("Request body must be valid JSON", null), 400)
  }
  const validated = validatePayload(value)
  if ("error" in validated) return c.json(validated.error, 400)

  const response = await createEmbeddings(validated.payload, c.req.raw.signal)
  copySafeHeaders(response, (name, header) => c.header(name, header))
  if (!response.ok) {
    return c.json(
      await upstreamError(response),
      response.status as ContentfulStatusCode,
    )
  }

  const result = (await response.json()) as Record<string, unknown>
  return c.json({
    ...result,
    object: "list",
    model: validated.payload.model,
  })
})
