/**
 * Shared helpers for standalone proxy validation scripts (see
 * scripts/proxy-model-validation.ts). Not part of the shipped server: this
 * module authenticates directly against the upstream Copilot API (bypassing
 * the local proxy), fetches and classifies the model catalog, and provides
 * small header/formatting helpers used to build the 3-dimension
 * (direct / proxy-messages / proxy-chat) blame matrix report.
 *
 * Uses the same building blocks as scripts/context-boundary-validation.ts:
 * the persisted GitHub token is exchanged for a Copilot token via
 * ~/services/github/get-copilot-token, and headers are built with the real
 * ~/lib/api-config helpers so requests look identical to what the shipped
 * server sends.
 */

import { readFile } from "node:fs/promises"

import type { UpstreamEndpoint } from "~/lib/endpoint-routing"
import type { Model, ModelsResponse } from "~/services/copilot/get-models"

import { copilotHeaders as buildCopilotHeaders } from "~/lib/api-config"
import { resolveEndpoint } from "~/lib/endpoint-routing"
import { PATHS } from "~/lib/paths"
import { state } from "~/lib/state"
import { getCopilotToken } from "~/services/github/get-copilot-token"

export type CopilotModel = Model

export interface ModelProfile {
  id: string
  endpoint: UpstreamEndpoint
  isClaude: boolean
  toolSupport: boolean
  thinkingSupport: "adaptive" | "enabled-only" | "none"
  effortSupport: "param" | "none"
  temperatureSupport: boolean
  maxOutputTokens: number
}

export interface TestResult {
  test: string
  model: string
  endpoint: string
  status: "pass" | "fail" | "skip"
  detail?: string
  durationMs: number
}

/** Direct (non-proxied) upstream Copilot API base URL. */
export const COPILOT_API_BASE_URL =
  process.env.COPILOT_API_BASE_URL ?? "https://api.githubcopilot.com"

/** Local copilot-api proxy base URL. */
export const PROXY_URL = (
  process.env.PROXY_URL ?? "http://localhost:4141"
).replace(/\/$/, "")

/**
 * Authenticate using the GitHub token persisted by `copilot-api auth`,
 * exchange it for a Copilot token, and return that token — the "jwt" used
 * to call the upstream Copilot API directly.
 */
export async function getJwt(): Promise<string> {
  const githubToken = (await readFile(PATHS.GITHUB_TOKEN_PATH, "utf8")).trim()
  if (!githubToken) {
    throw new Error(
      `No GitHub token found at ${PATHS.GITHUB_TOKEN_PATH}. Run 'bun run dev auth' first.`,
    )
  }
  state.githubToken = githubToken
  const tokenResponse = await getCopilotToken()
  state.copilotToken = tokenResponse.token
  return tokenResponse.token
}

/** Build headers for a direct (non-proxied) request to the Copilot API. */
export function copilotHeaders(jwt: string): Record<string, string> {
  state.copilotToken = jwt
  return buildCopilotHeaders(state)
}

/** Build headers for a request to the local proxy's /v1/messages endpoint. */
export function proxyHeaders(): Record<string, string> {
  return {
    "content-type": "application/json",
    "anthropic-version": "2023-06-01",
  }
}

/** Fetch the full model catalog directly from the upstream Copilot API. */
export async function fetchModels(jwt: string): Promise<Array<CopilotModel>> {
  const response = await fetch(`${COPILOT_API_BASE_URL}/models`, {
    headers: copilotHeaders(jwt),
  })
  if (!response.ok) {
    throw new Error(`Failed to fetch models: HTTP ${response.status}`)
  }
  const body = (await response.json()) as ModelsResponse
  return body.data
}

/** Keep only chat-completion models (drop embeddings and other non-chat types). */
export function filterChatModels(
  models: Array<CopilotModel>,
): Array<CopilotModel> {
  return models.filter((model) => model.capabilities.type === "chat")
}

/**
 * Capability fields the live catalog advertises but that the shared `Model`
 * type (src/services/copilot/get-models.ts) doesn't declare, because
 * production code doesn't consume them yet (see `ModelSupports`).
 */
type ModelSupports = Model["capabilities"]["supports"]
interface ExtendedSupports extends ModelSupports {
  adaptive_thinking?: boolean
}

/** Classify a model's proxy-relevant capabilities for the validation report. */
export function classifyModel(model: CopilotModel): ModelProfile {
  const catalog: ModelsResponse = { object: "list", data: [model] }
  const endpoint = resolveEndpoint(model.id, catalog)
  const isClaude = model.id.startsWith("claude-")
  const supports = model.capabilities.supports
  const extended: ExtendedSupports = supports

  let thinkingSupport: ModelProfile["thinkingSupport"] = "none"
  if (isClaude) {
    thinkingSupport = extended.adaptive_thinking ? "adaptive" : "enabled-only"
  }

  return {
    id: model.id,
    endpoint,
    isClaude,
    toolSupport: Boolean(supports.tool_calls),
    thinkingSupport,
    effortSupport:
      (supports.reasoning_effort?.length ?? 0) > 0 ? "param" : "none",
    temperatureSupport: endpoint !== "/responses",
    maxOutputTokens: model.capabilities.limits.max_output_tokens ?? 0,
  }
}

/** Format a millisecond duration for compact report tables. */
export function fmtMs(ms: number): string {
  return ms < 1000 ? `${Math.round(ms)}ms` : `${(ms / 1000).toFixed(2)}s`
}
