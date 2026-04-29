import { state } from "./state"

// Forward map: Anthropic dash format → Copilot dot format
const MODEL_ID_MAP: Record<string, string> = {
  "claude-opus-4-7": "claude-opus-4.7",
  "claude-opus-4-6": "claude-opus-4.6",
  "claude-opus-4-5": "claude-opus-4.5",
  "claude-sonnet-4-6": "claude-sonnet-4.6",
  "claude-sonnet-4-5": "claude-sonnet-4.5",
  "claude-sonnet-4": "claude-sonnet-4",
  "claude-opus-4": "claude-opus-4",
  "claude-haiku-4-5": "claude-haiku-4.5",
}

/** Suffixes that encode effort level — stripped before mapping, re-appended after */
const EFFORT_SUFFIXES = ["-xhigh", "-high"] as const

// Reverse map: Copilot dot format → Anthropic dash format
const REVERSE_MODEL_ID_MAP: Record<string, string> = Object.fromEntries(
  Object.entries(MODEL_ID_MAP).map(([k, v]) => [v, k]),
)

/**
 * Convert an Anthropic-style model ID to a Copilot-style model ID.
 * Strips date suffixes, converts dashes to dots, and appends -1m if needed.
 * Only appends -1m if the model actually has a 1M variant in the cached models.
 */
export function anthropicToCopilotModelId(
  model: string,
  is1M: boolean,
): string {
  let base = model

  // Strip [1m] suffix if present (Claude Code sends this)
  const has1MSuffix = base.endsWith("[1m]")
  if (has1MSuffix) {
    base = base.slice(0, -4)
  }

  // Strip effort suffixes (-high, -xhigh) — re-appended after mapping
  let effortSuffix = ""
  for (const suffix of EFFORT_SUFFIXES) {
    if (base.endsWith(suffix)) {
      effortSuffix = suffix
      base = base.slice(0, -suffix.length)
      break
    }
  }

  // Strip date suffixes (e.g. claude-sonnet-4-20250514 → claude-sonnet-4)
  if (/^claude-sonnet-4-\d{8}/.test(base)) {
    base = "claude-sonnet-4"
  } else if (/^claude-opus-4-\d{8}/.test(base)) {
    base = "claude-opus-4"
  }

  const mapped = MODEL_ID_MAP[base] ?? base

  // Re-append effort suffix — check catalog first
  if (effortSuffix) {
    const candidate = `${mapped}${effortSuffix}`
    if (state.models?.data.some((m) => m.id === candidate)) {
      return candidate
    }
  }

  const use1M = is1M || has1MSuffix

  // Only append -1m if the 1M variant actually exists in the model catalog
  if (use1M) {
    const candidate = `${mapped}-1m`
    const exists = state.models?.data.some((m) => m.id === candidate)
    if (exists) return candidate

    // Try -1m-internal (transient preview suffix, will be dropped when model graduates)
    const internalCandidate = `${mapped}-1m-internal`
    const internalExists = state.models?.data.some(
      (m) => m.id === internalCandidate,
    )
    if (internalExists) return internalCandidate
  }

  return mapped
}

/**
 * Convert a Copilot-style model ID back to Anthropic-style.
 * Converts dots to dashes and maps -1m back to [1m].
 * Strips -internal and -high/-xhigh suffixes — callers like Claude Code's
 * getCanonicalName() don't recognize effort variants and would break on
 * model display, effort checks, and capability lookups. The effort level
 * is a request-time concern; the response uses the base model identity.
 */
export function copilotToAnthropicModelId(copilotModel: string): string {
  let base = copilotModel

  // Strip suffixes in the correct order: -internal first, then effort, then -1m
  // Model IDs are structured as: base[-1m[-internal]][-high|-xhigh]

  // 1. Strip -internal (transient preview suffix)
  if (base.endsWith("-internal")) base = base.slice(0, -9)

  // 2. Strip effort suffixes (-high, -xhigh) — these are request-time concerns
  for (const suffix of EFFORT_SUFFIXES) {
    if (base.endsWith(suffix)) {
      base = base.slice(0, -suffix.length)
      break
    }
  }

  // 3. Strip -1m
  const is1M = base.endsWith("-1m")
  if (is1M) base = base.slice(0, -3)

  const mapped = REVERSE_MODEL_ID_MAP[base] ?? base
  return is1M ? `${mapped}[1m]` : mapped
}
