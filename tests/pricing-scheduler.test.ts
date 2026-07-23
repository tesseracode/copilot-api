import { afterEach, describe, expect, it } from "bun:test"

import {
  startPricingScheduler,
  stopPricingScheduler,
} from "~/services/copilot/pricing-scheduler"

afterEach(() => {
  stopPricingScheduler()
})

describe("pricing scheduler", () => {
  it("refreshes pricing immediately on startup", async () => {
    let calls = 0

    await startPricingScheduler(() => {
      calls += 1
      return Promise.resolve({ status: "updated" })
    })

    expect(calls).toBe(1)
  })

  it("deduplicates concurrent scheduler starts", async () => {
    let calls = 0
    let resolveRefresh: ((value: { status: string }) => void) | undefined
    const updater = () => {
      calls += 1
      return new Promise<{ status: string }>((resolve) => {
        resolveRefresh = resolve
      })
    }

    const starts = [
      startPricingScheduler(updater),
      startPricingScheduler(updater),
    ]
    expect(calls).toBe(1)
    if (!resolveRefresh) throw new Error("Expected pending refresh")
    resolveRefresh({ status: "updated" })
    await Promise.all(starts)

    expect(calls).toBe(1)
  })

  it("does not reject startup when pricing refresh fails", async () => {
    let rejected = false
    try {
      await startPricingScheduler(() => Promise.reject(new Error("offline")))
    } catch {
      rejected = true
    }
    expect(rejected).toBe(false)
  })
})
