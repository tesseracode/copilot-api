import { Hono } from "hono"

import { copilotBaseUrl } from "~/lib/api-config"
import { copilotFetch } from "~/lib/copilot-fetch"
import { wrapResponsesStream } from "~/lib/responses-stream-wrapper"
import { state } from "~/lib/state"

export const responsesRoutes = new Hono()

responsesRoutes.post("/", async (c) => {
  let payload: Record<string, unknown>
  try {
    payload = await c.req.json<Record<string, unknown>>()
  } catch {
    return c.json(
      { error: { message: "Request body must be valid JSON" } },
      400,
    )
  }

  const modelId = typeof payload.model === "string" ? payload.model : ""
  if (!modelId) {
    return c.json(
      { error: { message: "Responses request requires model" } },
      400,
    )
  }
  if (payload.stream !== undefined && typeof payload.stream !== "boolean") {
    return c.json({ error: { message: "stream must be a boolean" } }, 400)
  }

  const model = state.models?.data.find((item) => item.id === modelId)
  if (!model?.supported_endpoints?.includes("/responses")) {
    return c.json(
      {
        error: {
          message: `Model ${modelId} does not advertise /responses support`,
        },
      },
      400,
    )
  }

  const upstream = await copilotFetch(`${copilotBaseUrl(state)}/responses`, {
    method: "POST",
    body: JSON.stringify(payload),
    signal: c.req.raw.signal,
  })

  const headers = new Headers()
  const contentType = upstream.headers.get("content-type")
  if (contentType) headers.set("content-type", contentType)
  for (const name of [
    "cache-control",
    "openai-processing-ms",
    "retry-after",
    "x-copilot-service-request-id",
    "x-github-request-id",
    "x-ratelimit-limit",
    "x-ratelimit-remaining",
    "x-ratelimit-reset",
  ]) {
    const value = upstream.headers.get(name)
    if (value) headers.set(name, value)
  }

  const responseBody =
    contentType?.startsWith("text/event-stream") && upstream.body ?
      wrapResponsesStream(upstream.body, c.req.raw.signal)
    : upstream.body

  return new Response(responseBody, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers,
  })
})
