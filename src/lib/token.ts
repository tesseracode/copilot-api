import consola from "consola"
import fs from "node:fs/promises"

import { PATHS } from "~/lib/paths"
import {
  getCopilotToken,
  type GetCopilotTokenResponse,
} from "~/services/github/get-copilot-token"
import { getDeviceCode } from "~/services/github/get-device-code"
import { getGitHubUser } from "~/services/github/get-user"
import { pollAccessToken } from "~/services/github/poll-access-token"

import { HTTPError } from "./error"
import { state } from "./state"

const readGithubToken = () => fs.readFile(PATHS.GITHUB_TOKEN_PATH, "utf8")

const writeGithubToken = (token: string) =>
  fs.writeFile(PATHS.GITHUB_TOKEN_PATH, token)

const REFRESH_LEEWAY_SECONDS = 60
const REFRESH_RETRY_SECONDS = 30

let refreshPromise: Promise<GetCopilotTokenResponse> | undefined
let refreshTimer: ReturnType<typeof setTimeout> | undefined
let shutdownHandlersInstalled = false
let shuttingDown = false

function scheduleTimer(callback: () => void, delaySeconds: number): void {
  if (shuttingDown) return
  if (refreshTimer) clearTimeout(refreshTimer)
  refreshTimer = setTimeout(callback, delaySeconds * 1000)
}

function scheduleRetry(): void {
  scheduleTimer(() => {
    void refreshCopilotToken().catch((error: unknown) => {
      consola.error("Copilot token refresh retry failed; retrying soon:", error)
      scheduleRetry()
    })
  }, REFRESH_RETRY_SECONDS)
}

function scheduleRefresh(response: GetCopilotTokenResponse): void {
  const delaySeconds = Math.max(
    1,
    Math.min(
      response.refresh_in - REFRESH_LEEWAY_SECONDS,
      response.expires_at
        - Math.floor(Date.now() / 1000)
        - REFRESH_LEEWAY_SECONDS,
    ),
  )
  scheduleTimer(() => {
    void refreshCopilotToken().catch((error: unknown) => {
      consola.error("Failed to refresh Copilot token; retrying soon:", error)
      scheduleRetry()
    })
  }, delaySeconds)
}

export function refreshCopilotToken(): Promise<GetCopilotTokenResponse> {
  refreshPromise ??= getCopilotToken()
    .then((response) => {
      state.copilotToken = response.token
      scheduleRefresh(response)
      consola.debug("Copilot token refreshed")
      if (state.showToken)
        consola.info("Refreshed Copilot token:", response.token)
      return response
    })
    .finally(() => {
      refreshPromise = undefined
    })
  return refreshPromise
}

export const setupCopilotToken = async () => {
  await refreshCopilotToken()
  consola.debug("GitHub Copilot Token fetched successfully!")

  if (!shutdownHandlersInstalled) {
    shutdownHandlersInstalled = true
    for (const sig of ["SIGINT", "SIGTERM"] as const) {
      process.once(sig, () => {
        shuttingDown = true
        if (refreshTimer) clearTimeout(refreshTimer)
      })
    }
  }
}

interface SetupGitHubTokenOptions {
  force?: boolean
}

export async function setupGitHubToken(
  options?: SetupGitHubTokenOptions,
): Promise<void> {
  try {
    const githubToken = await readGithubToken()

    if (githubToken && !options?.force) {
      state.githubToken = githubToken
      if (state.showToken) {
        consola.info("GitHub token:", githubToken)
      }
      await logUser()

      return
    }

    consola.info("Not logged in, getting new access token")
    const response = await getDeviceCode()
    consola.debug("Device code response:", response)

    consola.info(
      `Please enter the code "${response.user_code}" in ${response.verification_uri}`,
    )

    const token = await pollAccessToken(response)
    await writeGithubToken(token)
    state.githubToken = token

    if (state.showToken) {
      consola.info("GitHub token:", token)
    }
    await logUser()
  } catch (error) {
    if (error instanceof HTTPError) {
      consola.error("Failed to get GitHub token:", await error.response.json())
      throw error
    }

    consola.error("Failed to get GitHub token:", error)
    throw error
  }
}

async function logUser() {
  const user = await getGitHubUser()
  consola.info(`Logged in as ${user.login}`)
}
