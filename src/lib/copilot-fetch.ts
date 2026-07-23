import consola from "consola"

import { refreshCopilotToken } from "~/lib/token"

import { copilotHeaders } from "./api-config"
import { state } from "./state"

type CopilotRequestInit = Omit<RequestInit, "headers"> & {
  headers?: Record<string, string>
}

interface CopilotFetchOptions {
  vision?: boolean
  refresh?: () => Promise<unknown>
}

function mergeHeaders(
  defaults: Record<string, string>,
  overrides?: Record<string, string>,
): Record<string, string> {
  return { ...defaults, ...overrides }
}

export async function copilotFetch(
  input: string | URL,
  init: CopilotRequestInit = {},
  options: CopilotFetchOptions = {},
): Promise<Response> {
  const send = () =>
    fetch(input, {
      ...init,
      headers: mergeHeaders(
        copilotHeaders(state, options.vision),
        init.headers,
      ),
    })

  const requestToken = state.copilotToken
  let response = await send()
  if (response.status !== 401 || init.signal?.aborted) return response
  if (init.body && typeof init.body !== "string") return response

  consola.warn(
    "Copilot request returned 401; refreshing IDE token and retrying",
  )
  try {
    await response.body?.cancel()
  } catch (error) {
    consola.debug("Failed to cancel rejected Copilot response body", error)
  }
  if (!requestToken || state.copilotToken === requestToken) {
    await (options.refresh ?? refreshCopilotToken)()
  }
  response = await send()
  return response
}
