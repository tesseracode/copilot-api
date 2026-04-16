// Forward map: Anthropic dash format → Copilot dot format
const MODEL_ID_MAP: Record<string, string> = {
  "claude-opus-4-6": "claude-opus-4.6",
  "claude-opus-4-5": "claude-opus-4.5",
  "claude-sonnet-4-6": "claude-sonnet-4.6",
  "claude-sonnet-4-5": "claude-sonnet-4.5",
  "claude-sonnet-4": "claude-sonnet-4",
  "claude-opus-4": "claude-opus-4",
}

// Reverse map: Copilot dot format → Anthropic dash format
const REVERSE_MODEL_ID_MAP: Record<string, string> = Object.fromEntries(
  Object.entries(MODEL_ID_MAP).map(([k, v]) => [v, k]),
)

/**
 * Convert an Anthropic-style model ID to a Copilot-style model ID.
 * Strips date suffixes, converts dashes to dots, and appends -1m if needed.
 */
export function anthropicToCopilotModelId(
  model: string,
  is1M: boolean,
): string {
  let base = model

  // Strip date suffixes (e.g. claude-sonnet-4-20250514 → claude-sonnet-4)
  if (/^claude-sonnet-4-\d{8}/.test(base)) {
    base = "claude-sonnet-4"
  } else if (/^claude-opus-4-\d{8}/.test(base)) {
    base = "claude-opus-4"
  }

  const mapped = MODEL_ID_MAP[base] ?? base
  return is1M ? `${mapped}-1m` : mapped
}

/**
 * Convert a Copilot-style model ID back to Anthropic-style.
 * Converts dots to dashes and maps -1m back to [1m].
 */
export function copilotToAnthropicModelId(copilotModel: string): string {
  const is1M = copilotModel.endsWith("-1m")
  const base = is1M ? copilotModel.slice(0, -3) : copilotModel
  const mapped = REVERSE_MODEL_ID_MAP[base] ?? base
  return is1M ? `${mapped}[1m]` : mapped
}
