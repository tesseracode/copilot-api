import consola from "consola"

import { updateCopilotPricing } from "~/lib/copilot-pricing"

const REFRESH_INTERVAL_MS = 30 * 60 * 1000

type PricingUpdater = () => Promise<{ status: string }>

let refreshPromise: Promise<void> | undefined
let refreshTimer: ReturnType<typeof setTimeout> | undefined
let pricingUpdater: PricingUpdater = updateCopilotPricing
let shuttingDown = false
let shutdownHandlersInstalled = false

async function refreshPricing(): Promise<void> {
  refreshPromise ??= pricingUpdater()
    .then((result) => {
      consola.debug(`Copilot pricing cache ${result.status}`)
    })
    .catch((error: unknown) => {
      consola.warn("Failed to refresh Copilot pricing cache:", error)
    })
    .finally(() => {
      refreshPromise = undefined
    })
  return refreshPromise
}

function scheduleNextRefresh(): void {
  if (shuttingDown) return
  refreshTimer = setTimeout(() => {
    void refreshPricing().finally(scheduleNextRefresh)
  }, REFRESH_INTERVAL_MS)
  refreshTimer.unref()
}

export async function startPricingScheduler(
  updater: PricingUpdater = updateCopilotPricing,
): Promise<void> {
  shuttingDown = false
  pricingUpdater = updater
  await refreshPricing()
  if (!refreshTimer) scheduleNextRefresh()

  if (!shutdownHandlersInstalled) {
    shutdownHandlersInstalled = true
    for (const signal of ["SIGINT", "SIGTERM"] as const) {
      process.once(signal, stopPricingScheduler)
    }
  }
}

export function stopPricingScheduler(): void {
  shuttingDown = true
  if (refreshTimer) clearTimeout(refreshTimer)
  refreshTimer = undefined
}
