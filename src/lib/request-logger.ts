import type { MiddlewareHandler } from "hono"

import consola from "consola"
import { randomUUID } from "node:crypto"

const VERBOSE_BODY_TAIL = 2000

function formatHeaders(headers: Headers): string {
  const entries: Array<string> = []
  for (const [key, value] of headers.entries()) {
    // Mask authorization tokens, show only last 8 chars
    const safeValue =
      key.toLowerCase() === "authorization" && value.length > 12 ?
        `***${value.slice(-8)}`
      : value
    entries.push(`  ${key}: ${safeValue}`)
  }
  return entries.join("\n")
}

function tailOfBody(body: string): string {
  if (body.length <= VERBOSE_BODY_TAIL) return body
  return `...[truncated ${body.length - VERBOSE_BODY_TAIL} chars]...\n${body.slice(-VERBOSE_BODY_TAIL)}`
}

export const requestLogger: MiddlewareHandler = async (c, next) => {
  const requestId = c.req.header("x-request-id") ?? randomUUID()
  const userAgent = c.req.header("user-agent") ?? "unknown"
  const method = c.req.method
  const path = c.req.path
  const clientIp =
    c.req.header("x-forwarded-for")?.split(",")[0]?.trim()
    ?? c.req.header("x-real-ip")
    ?? "unknown"

  // Set request ID on response for traceability
  c.header("x-request-id", requestId)

  const tag = requestId.slice(0, 8)
  const start = performance.now()

  consola.info(
    `→ [${tag}] ${method} ${path} | agent: ${userAgent} | ip: ${clientIp}`,
  )

  // Verbose mode: log headers and body tail (only at debug level / --verbose)
  if (consola.level >= 5) {
    consola.debug(`→ [${tag}] Headers:\n${formatHeaders(c.req.raw.headers)}`)

    if (method !== "GET" && method !== "HEAD") {
      try {
        const body = await c.req.text()
        consola.debug(`→ [${tag}] Body (tail):\n${tailOfBody(body)}`)
      } catch {
        consola.debug(`→ [${tag}] Body: <unable to read>`)
      }
    }
  }

  await next()

  const duration = (performance.now() - start).toFixed(1)

  consola.info(`← [${tag}] ${method} ${path} | ${c.res.status} | ${duration}ms`)
}
