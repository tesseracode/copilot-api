import consola from "consola"

import { isClientAbort, STREAM_TRANSPORT_ERROR } from "./streaming"

const encoder = new TextEncoder()

function isTerminalErrorFrame(frame: string): boolean {
  const lines = frame.split(/\r?\n/)
  const event = lines
    .find((line) => line.startsWith("event:"))
    ?.slice("event:".length)
    .trim()
  if (event === "error") return true

  const data = lines
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice("data:".length).trimStart())
    .join("\n")
  if (!data || data === "[DONE]") return false
  try {
    const parsed = JSON.parse(data) as { type?: unknown }
    return parsed.type === "error" || parsed.type === "response.failed"
  } catch {
    return false
  }
}

export function wrapResponsesStream(
  body: ReadableStream<Uint8Array>,
  signal?: AbortSignal,
): ReadableStream<Uint8Array> {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let frameBuffer = ""
  let terminalErrorSeen = false
  let abortListener: (() => void) | undefined

  function cleanup(): void {
    if (abortListener) signal?.removeEventListener("abort", abortListener)
  }

  function inspect(chunk: Uint8Array): void {
    frameBuffer += decoder.decode(chunk, { stream: true })
    const frames = frameBuffer.split(/\r?\n\r?\n/)
    frameBuffer = frames.pop() ?? ""
    terminalErrorSeen ||= frames.some((frame) => isTerminalErrorFrame(frame))
  }

  return new ReadableStream<Uint8Array>({
    start(controller) {
      abortListener = () => void reader.cancel(signal?.reason)
      if (signal?.aborted) {
        abortListener()
        controller.close()
      } else {
        signal?.addEventListener("abort", abortListener, { once: true })
      }
    },
    async pull(controller) {
      try {
        const result = await reader.read()
        if (result.done) {
          cleanup()
          controller.close()
          return
        }
        inspect(result.value)
        controller.enqueue(result.value)
      } catch (error) {
        cleanup()
        if (isClientAbort(error, signal)) {
          controller.close()
          return
        }
        const errorName = error instanceof Error ? error.name : typeof error
        consola.error(`native Responses stream failed (${errorName})`)
        if (!terminalErrorSeen) {
          controller.enqueue(
            encoder.encode(
              `event: error\ndata: ${JSON.stringify({
                type: "error",
                code: STREAM_TRANSPORT_ERROR.code,
                message: STREAM_TRANSPORT_ERROR.message,
                param: null,
              })}\n\n`,
            ),
          )
        }
        controller.close()
      }
    },
    async cancel(reason) {
      cleanup()
      await reader.cancel(reason)
    },
  })
}
