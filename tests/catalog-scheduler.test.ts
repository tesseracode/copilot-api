import { afterEach, beforeEach, describe, expect, it } from "bun:test"

import type { ModelsResponse } from "~/services/copilot/get-models"

import { catalogFingerprint } from "~/lib/build-info"
import { state } from "~/lib/state"
import {
  DEFAULT_CATALOG_REFRESH_MS,
  refreshCatalogNow,
  startCatalogScheduler,
  stopCatalogScheduler,
} from "~/services/copilot/catalog-scheduler"

function catalog(ids: Array<string>): ModelsResponse {
  return {
    object: "list",
    data: ids.map((id) => ({
      id,
      name: id,
      object: "model",
      vendor: "openai",
      version: "1",
      preview: false,
      model_picker_enabled: true,
      supported_endpoints: ["/responses"],
      capabilities: {
        family: "gpt",
        limits: {},
        object: "model_capabilities",
        supports: {},
        tokenizer: "test",
        type: "chat",
      },
    })),
  }
}

/** Mirrors what cacheModels() does, without touching the network. */
function applyCatalog(ids: Array<string>): void {
  const models = catalog(ids)
  state.models = models
  state.modelsObservedAt = new Date().toISOString()
  state.modelsFingerprint = catalogFingerprint(models.data)
}

beforeEach(() => {
  applyCatalog(["gpt-a"])
})

afterEach(() => {
  stopCatalogScheduler()
  state.models = undefined
  state.modelsFingerprint = undefined
  state.modelsObservedAt = undefined
})

describe("catalog scheduler", () => {
  it("matches the upstream six hour cache hint by default", () => {
    expect(DEFAULT_CATALOG_REFRESH_MS).toBe(21_600_000)
  })

  it("does not refresh on start, preserving the startup snapshot", () => {
    let calls = 0
    startCatalogScheduler({
      intervalMs: 60_000,
      updater: () => {
        calls += 1
        return Promise.resolve()
      },
    })
    expect(calls).toBe(0)
  })

  it("replaces the snapshot and updates both provenance markers", async () => {
    const before = state.modelsFingerprint
    const observedBefore = state.modelsObservedAt

    startCatalogScheduler({
      intervalMs: 60_000,
      updater: () => {
        applyCatalog(["gpt-a", "gpt-b"])
        return Promise.resolve()
      },
    })
    await Bun.sleep(2)
    await refreshCatalogNow()

    expect(state.models?.data).toHaveLength(2)
    expect(state.modelsFingerprint).not.toBe(before)
    expect(state.modelsObservedAt).not.toBe(observedBefore)
  })

  it("refreshes the observation timestamp even when content is identical", async () => {
    const fingerprintBefore = state.modelsFingerprint
    const observedBefore = state.modelsObservedAt

    startCatalogScheduler({
      intervalMs: 60_000,
      updater: () => {
        applyCatalog(["gpt-a"])
        return Promise.resolve()
      },
    })
    await Bun.sleep(2)
    await refreshCatalogNow()

    expect(state.modelsFingerprint).toBe(fingerprintBefore)
    expect(state.modelsObservedAt).not.toBe(observedBefore)
  })

  it("keeps the previous snapshot when a refresh fails", async () => {
    const fingerprintBefore = state.modelsFingerprint

    startCatalogScheduler({
      intervalMs: 60_000,
      updater: () => Promise.reject(new Error("offline")),
    })
    await refreshCatalogNow()

    expect(state.models?.data).toHaveLength(1)
    expect(state.modelsFingerprint).toBe(fingerprintBefore)
  })

  it("does not reject the caller when a refresh fails", async () => {
    let rejected = false
    startCatalogScheduler({
      intervalMs: 60_000,
      updater: () => Promise.reject(new Error("offline")),
    })
    try {
      await refreshCatalogNow()
    } catch {
      rejected = true
    }
    expect(rejected).toBe(false)
  })

  it("recovers on the next refresh after a failure", async () => {
    let shouldFail = true
    startCatalogScheduler({
      intervalMs: 60_000,
      updater: () => {
        if (shouldFail) return Promise.reject(new Error("offline"))
        applyCatalog(["gpt-a", "gpt-c"])
        return Promise.resolve()
      },
    })

    await refreshCatalogNow()
    expect(state.models?.data).toHaveLength(1)

    shouldFail = false
    await refreshCatalogNow()
    expect(state.models?.data).toHaveLength(2)
  })

  it("shares a single in-flight refresh across concurrent triggers", async () => {
    let calls = 0
    let release: (() => void) | undefined
    startCatalogScheduler({
      intervalMs: 60_000,
      updater: () => {
        calls += 1
        return new Promise<void>((resolve) => {
          release = resolve
        })
      },
    })

    const triggers = [refreshCatalogNow(), refreshCatalogNow()]
    expect(calls).toBe(1)
    if (!release) throw new Error("Expected a pending refresh")
    release()
    await Promise.all(triggers)

    expect(calls).toBe(1)
  })

  it("never schedules a refresh when the interval is zero", async () => {
    let calls = 0
    startCatalogScheduler({
      intervalMs: 0,
      updater: () => {
        calls += 1
        return Promise.resolve()
      },
    })

    await Bun.sleep(20)
    expect(calls).toBe(0)
  })

  it("refreshes on the configured interval", async () => {
    let calls = 0
    startCatalogScheduler({
      intervalMs: 5,
      updater: () => {
        calls += 1
        applyCatalog(["gpt-a"])
        return Promise.resolve()
      },
    })

    await Bun.sleep(60)
    expect(calls).toBeGreaterThan(0)
  })

  it("stops refreshing once the scheduler is stopped", async () => {
    let calls = 0
    startCatalogScheduler({
      intervalMs: 5,
      updater: () => {
        calls += 1
        return Promise.resolve()
      },
    })

    await Bun.sleep(40)
    stopCatalogScheduler()
    const callsAtStop = calls

    await Bun.sleep(40)
    expect(calls).toBe(callsAtStop)
  })
})
