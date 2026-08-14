import type { ModelsResponse } from "~/services/copilot/get-models"

export interface State {
  hideInternal: boolean
  modelFilter?: string
  githubToken?: string
  copilotToken?: string

  accountType: string
  models?: ModelsResponse
  /** When the current catalog snapshot was observed, not the current time. */
  modelsObservedAt?: string
  /** Fingerprint of the routing-relevant fields of the current snapshot. */
  modelsFingerprint?: string
  vsCodeVersion?: string

  manualApprove: boolean
  rateLimitWait: boolean
  showToken: boolean

  // 1M context window flag (derived from ANTHROPIC_MODEL env var)
  is1MContext: boolean

  // Rate limiting configuration
  rateLimitSeconds?: number
  lastRequestTimestamp?: number
}

export const state: State = {
  hideInternal: false,
  accountType: "individual",
  manualApprove: false,
  is1MContext: false,
  rateLimitWait: false,
  showToken: false,
}
