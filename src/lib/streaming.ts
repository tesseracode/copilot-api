import type { Context } from "hono"
import type { SSEStreamingApi } from "hono/streaming"

import consola from "consola"
import { streamSSE } from "hono/streaming"

/**
 * Narrow a service result to its non-streaming form.
 *
 * Streaming services return an async iterable; non-streaming ones return a
 * plain response object. Test the property that actually defines the
 * distinction rather than a proxy for it: an earlier version checked for an own
 * `choices` property, which happened to work only because the iterator returned
 * by `events()` does not expose one (see POTENTIAL_FEATURES.md #3).
 */
export function isNonStreaming<T>(
  response: T,
): response is Exclude<T, AsyncIterable<unknown>> {
  return !(Symbol.asyncIterator in Object(response))
}

export interface StreamSSEOptions {
  /** Request signal; an abort on it means the client went away. */
  signal?: AbortSignal
  /** Label used when logging a client disconnect. */
  label: string
  /** Writes a format-specific terminal event for non-abort failures. */
  onError?: (stream: SSEStreamingApi, error: unknown) => Promise<void> | void
  /** Reports that the upstream already emitted an in-band terminal error. */
  hasTerminalError?: () => boolean
}

/**
 * Wrap an SSE producer so that a client disconnect ends the stream quietly.
 *
 * A disconnect shows up either as an already-aborted request signal or as an
 * `AbortError` thrown while the upstream stream is being consumed. Neither is a
 * failure worth surfacing, so the stream simply ends. Other failures are
 * converted by the optional format-specific writer or rethrown when absent.
 *
 * This is the single definition of what "the client went away" means; it
 * previously existed as five structurally identical copies across the two route
 * handlers.
 */
export function streamSSEWithAbort(
  c: Context,
  { signal, label, onError, hasTerminalError }: StreamSSEOptions,
  produce: (stream: SSEStreamingApi) => Promise<void>,
): Response {
  return streamSSE(c, async (stream) => {
    try {
      await produce(stream)
    } catch (error) {
      if (isClientAbort(error, signal)) {
        consola.debug(`${label} stream aborted by client`)
        return
      }
      const errorName = error instanceof Error ? error.name : typeof error
      consola.error(`${label} stream failed (${errorName})`)
      if (hasTerminalError?.()) return
      if (!onError) throw error
      try {
        await onError(stream, error)
      } catch (writeError) {
        consola.debug(
          `${label} terminal error event could not be written`,
          writeError,
        )
      }
    }
  })
}

/**
 * Whether an error ending a stream means the client went away.
 *
 * Exported because this predicate is the only real logic in this module, and
 * it is not observable through a route: swallowing and rethrowing produce the
 * same client-visible result (headers are already sent, so both end as HTTP
 * 200 with a partial body and a clean EOF). It therefore has to be tested
 * directly.
 */
export function isClientAbort(error: unknown, signal?: AbortSignal): boolean {
  return (
    signal?.aborted === true
    || (error instanceof Error && error.name === "AbortError")
  )
}

export const STREAM_TRANSPORT_ERROR = {
  type: "api_error",
  code: "stream_transport_error",
  message: "The upstream stream terminated unexpectedly.",
} as const

export async function writeOpenAIStreamError(
  stream: SSEStreamingApi,
): Promise<void> {
  await stream.writeSSE({
    data: JSON.stringify({
      error: {
        type: STREAM_TRANSPORT_ERROR.type,
        code: STREAM_TRANSPORT_ERROR.code,
        message: STREAM_TRANSPORT_ERROR.message,
        param: null,
      },
    }),
  })
}
