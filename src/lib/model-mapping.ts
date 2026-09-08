import type { EffortLevel } from "./effort"

import { state } from "./state"

// Explicit overrides, for models whose IDs do not follow the version
// convention below. The derived rule handles every ordinary model, so this
// map only needs an entry when a model breaks the pattern.
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

/**
 * Anthropic writes a minor version as `-N`, Copilot writes it as `.N`. That is
 * a format convention between the two APIs rather than a model capability, so
 * it is derived rather than enumerated — an enumerated list silently drops
 * every model released after it was last edited.
 *
 * The minor version is bounded to two digits so an unstripped date suffix
 * (`claude-sonnet-4-20250514`) can never be read as one.
 */
const ANTHROPIC_VERSION = /^(claude-[a-z]+-\d+)-(\d{1,2})$/
const COPILOT_VERSION = /^(claude-[a-z]+-\d+)\.(\d{1,2})$/

/** Legacy effort suffixes that may appear in model names from old configs */
const EFFORT_SUFFIXES: ReadonlyArray<`-${EffortLevel}`> = [
  "-xhigh",
  "-high",
  "-max",
  "-medium",
  "-low",
]

// Reverse map: Copilot dot format → Anthropic dash format
const REVERSE_MODEL_ID_MAP: Record<string, string> = Object.fromEntries(
  Object.entries(MODEL_ID_MAP).map(([k, v]) => [v, k]),
)

/**
 * Strip a legacy effort suffix from a model name.
 * Returns the base name and the effort value (without the dash prefix).
 */
export function extractEffortFromModelName(model: string): {
  base: string
  effort: EffortLevel | undefined
} {
  for (const suffix of EFFORT_SUFFIXES) {
    if (model.endsWith(suffix)) {
      return {
        base: model.slice(0, -suffix.length),
        effort: suffix.slice(1) as EffortLevel, // strip leading dash
      }
    }
  }
  return { base: model, effort: undefined }
}

/**
 * Convert an Anthropic-style model ID to a Copilot-style model ID.
 * Strips date suffixes, effort suffixes, converts dashes to dots,
 * and appends -1m if needed.
 */
export function anthropicToCopilotModelId(
  model: string,
  is1M: boolean,
): string {
  let base = model

  // Strip [1m] suffix if present (Claude Code sends this)
  const has1MBracket = base.endsWith("[1m]")
  if (has1MBracket) {
    base = base.slice(0, -4)
  }

  // Strip -1m suffix if present (legacy config format)
  const has1MDash = !has1MBracket && base.endsWith("-1m")
  if (has1MDash) {
    base = base.slice(0, -3)
  }

  // Strip legacy effort suffixes (e.g. claude-opus-4-7-xhigh → claude-opus-4-7)
  const { base: withoutEffort } = extractEffortFromModelName(base)
  base = withoutEffort

  // Strip date suffixes (e.g. claude-sonnet-4-20250514 → claude-sonnet-4)
  if (/^claude-sonnet-4-\d{8}/.test(base)) {
    base = "claude-sonnet-4"
  } else if (/^claude-opus-4-\d{8}/.test(base)) {
    base = "claude-opus-4"
  }

  const mapped = MODEL_ID_MAP[base] ?? base.replace(ANTHROPIC_VERSION, "$1.$2")

  const use1M = is1M || has1MBracket || has1MDash

  // Only append -1m if the 1M variant actually exists in the model catalog
  if (use1M) {
    const candidate = `${mapped}-1m`
    const exists = state.models?.data.some((m) => m.id === candidate)
    if (exists) return candidate
  }

  return mapped
}

/**
 * Convert a Copilot-style model ID back to Anthropic-style.
 * Converts dots to dashes and maps -1m back to [1m].
 * Strips -internal suffix (transient preview artifact).
 * Effort is handled via output_config in the request body, not in the model ID.
 */
export function copilotToAnthropicModelId(copilotModel: string): string {
  let base = copilotModel

  // Strip -internal (transient preview suffix)
  if (base.endsWith("-internal")) base = base.slice(0, -9)

  // Strip -1m
  const is1M = base.endsWith("-1m")
  if (is1M) base = base.slice(0, -3)

  const mapped =
    REVERSE_MODEL_ID_MAP[base] ?? base.replace(COPILOT_VERSION, "$1-$2")
  return is1M ? `${mapped}[1m]` : mapped
}
