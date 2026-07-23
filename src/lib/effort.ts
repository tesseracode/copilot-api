import consola from "consola"

export type EffortLevel =
  | "none"
  | "minimal"
  | "low"
  | "medium"
  | "high"
  | "xhigh"
  | "max"

export type RequestedEffort = EffortLevel | "auto"

interface EffortCatalog {
  data: Array<{
    id: string
    capabilities: {
      supports: {
        reasoning_effort?: Array<EffortLevel>
      }
    }
  }>
}

const EFFORT_ORDER: Array<EffortLevel> = [
  "none",
  "minimal",
  "low",
  "medium",
  "high",
  "xhigh",
  "max",
]

const EFFORT_RANK = new Map(
  EFFORT_ORDER.map((effort, index) => [effort, index]),
)

interface ResolveEffortOptions {
  modelId: string
  requested?: string
  cachedModels?: EffortCatalog
  defaultEffort?: EffortLevel
}

export function resolveEffort({
  modelId,
  requested,
  cachedModels,
  defaultEffort,
}: ResolveEffortOptions): EffortLevel | undefined {
  const candidate =
    requested === "auto" || !requested ? defaultEffort : requested
  if (!candidate) return undefined

  const candidateRank = EFFORT_RANK.get(candidate as EffortLevel)
  if (candidateRank === undefined) {
    consola.warn(`Ignoring unknown reasoning effort "${candidate}"`)
    return undefined
  }

  const model = cachedModels?.data.find((item) => item.id === modelId)
  if (!model) return candidate as EffortLevel

  const supported = model.capabilities.supports.reasoning_effort
  if (!supported?.length) return undefined
  if (supported.includes(candidate as EffortLevel)) {
    return candidate as EffortLevel
  }

  const rankedSupported = supported.flatMap((effort) => {
    const rank = EFFORT_RANK.get(effort)
    return rank === undefined ? [] : [{ effort, rank }]
  })
  if (rankedSupported.length === 0) {
    consola.warn(`Model ${modelId} advertises no recognized reasoning efforts`)
    return undefined
  }
  rankedSupported.sort((a, b) => a.rank - b.rank)

  const fallback =
    rankedSupported.findLast((item) => item.rank <= candidateRank)
    ?? rankedSupported[0]

  consola.warn(
    `Model ${modelId} does not support reasoning effort ${candidate}; using ${fallback.effort}`,
  )
  return fallback.effort
}
