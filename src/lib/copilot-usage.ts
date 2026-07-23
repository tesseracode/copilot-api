export interface CopilotTokenDetail {
  batch_size: number
  cost_per_batch: number
  token_count: number
  token_type: string
}

export interface RawCopilotUsage {
  token_details: Array<CopilotTokenDetail>
  total_nano_aiu: number
}

export interface CopilotUsage extends RawCopilotUsage {
  total_ai_credits: number
  cache: {
    read_tokens: number
    write_tokens: number
    hit: boolean
  }
}

export function normalizeCopilotUsage(
  usage: RawCopilotUsage | undefined,
): CopilotUsage | undefined {
  if (!usage) return undefined
  const tokens = (type: string) =>
    usage.token_details
      .filter((detail) => detail.token_type === type)
      .reduce((total, detail) => total + detail.token_count, 0)
  const readTokens = tokens("cache_read")
  const writeTokens = tokens("cache_write")
  return {
    ...usage,
    total_ai_credits: usage.total_nano_aiu / 1_000_000_000,
    cache: {
      read_tokens: readTokens,
      write_tokens: writeTokens,
      hit: readTokens > 0,
    },
  }
}
