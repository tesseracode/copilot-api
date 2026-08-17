import consola from "consola"

import { state } from "~/lib/state"
import { cacheModels } from "~/lib/utils"

/**
 * Upstream serves /models with `cache-control: private, max-age=21600`, so a
 * six-hour cadence matches the provider's own expectation for how long a
 * catalog snapshot stays valid.
 */
export const DEFAULT_CATALOG_REFRESH_MS = 6 * 60 * 60 * 1000

type CatalogUpdater = () => Promise<void>

interface CatalogSchedulerOptions {
  /** Refresh cadence in milliseconds. Zero or negative disables refresh. */
  intervalMs?: number
  updater?: CatalogUpdater
}

let refreshPromise: Promise<void> | undefined
let refreshTimer: ReturnType<typeof setTimeout> | undefined
let catalogUpdater: CatalogUpdater = cacheModels
let refreshIntervalMs = DEFAULT_CATALOG_REFRESH_MS
let shuttingDown = false
let shutdownHandlersInstalled = false

function currentModelIds(): Array<string> {
  return (state.models?.data ?? []).map((model) => model.id)
}

/**
 * Adopting a catalog change silently would move requests between the native
 * Responses, Responses-translation and Chat paths with no operator signal, so
 * every routing-relevant change is named explicitly.
 */
function reportCatalogChange(
  previousIds: Array<string>,
  previousFingerprint: string | undefined,
): void {
  if (state.modelsFingerprint === previousFingerprint) return

  const nextIds = currentModelIds()
  const previous = new Set(previousIds)
  const next = new Set(nextIds)
  const added = nextIds.filter((id) => !previous.has(id))
  const removed = previousIds.filter((id) => !next.has(id))

  consola.info(
    `Copilot catalog changed (${nextIds.length} models): added [${
      added.join(", ") || "none"
    }], removed [${removed.join(", ") || "none"}]`,
  )
}

function refreshCatalog(): Promise<void> {
  refreshPromise ??= (() => {
    const previousIds = currentModelIds()
    const previousFingerprint = state.modelsFingerprint
    return catalogUpdater()
      .then(() => {
        reportCatalogChange(previousIds, previousFingerprint)
      })
      .catch((error: unknown) => {
        consola.warn(
          "Failed to refresh Copilot model catalog; keeping the previous snapshot:",
          error,
        )
      })
      .finally(() => {
        refreshPromise = undefined
      })
  })()
  return refreshPromise
}

function scheduleNextRefresh(): void {
  if (shuttingDown || refreshIntervalMs <= 0) return
  refreshTimer = setTimeout(() => {
    void refreshCatalog().finally(scheduleNextRefresh)
  }, refreshIntervalMs)
  refreshTimer.unref()
}

/**
 * Starts periodic catalog refresh. The startup snapshot is already loaded by
 * `cacheModels()`, so this only schedules subsequent refreshes.
 */
export function startCatalogScheduler(
  options: CatalogSchedulerOptions = {},
): void {
  shuttingDown = false
  refreshIntervalMs = options.intervalMs ?? DEFAULT_CATALOG_REFRESH_MS
  catalogUpdater = options.updater ?? cacheModels

  if (refreshIntervalMs <= 0) {
    consola.info(
      "Copilot catalog refresh disabled; pinning the startup snapshot",
    )
    return
  }

  if (!refreshTimer) scheduleNextRefresh()

  if (!shutdownHandlersInstalled) {
    shutdownHandlersInstalled = true
    for (const signal of ["SIGINT", "SIGTERM"] as const) {
      process.once(signal, stopCatalogScheduler)
    }
  }
}

export function stopCatalogScheduler(): void {
  shuttingDown = true
  if (refreshTimer) clearTimeout(refreshTimer)
  refreshTimer = undefined
}

/** Triggers a refresh immediately, sharing any refresh already in flight. */
export function refreshCatalogNow(): Promise<void> {
  return refreshCatalog()
}
