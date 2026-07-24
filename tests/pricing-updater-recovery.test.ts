import { describe, expect, it } from "bun:test"
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"

import { readCopilotPricing, updateCopilotPricing } from "~/lib/copilot-pricing"

const fixture = `
- model: GPT-5.6 Sol
  input: $5.00
  output: $30.00
`

describe("pricing updater recovery", () => {
  it("retains successful timestamps on failure and clears errors on recovery", async () => {
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), "pricing-test-"))
    const target = path.join(directory, "pricing.json")
    try {
      const first = await updateCopilotPricing(
        () =>
          Promise.resolve(
            new Response(fixture, { headers: { etag: '"first"' } }),
          ),
        target,
      )
      const fetchedAt = first.cache?.source.fetched_at
      const validatedAt = first.cache?.source.validated_at

      const failed = await updateCopilotPricing(
        () => Promise.reject(new Error("offline")),
        target,
      )
      expect(failed.status).toBe("stale")
      expect(failed.cache?.source.fetched_at).toBe(fetchedAt)
      expect(failed.cache?.source.validated_at).toBe(validatedAt)
      expect(failed.cache?.source.last_attempt_at).toBeDefined()
      expect(failed.cache?.source.error).toBe("offline")

      const recovered = await updateCopilotPricing((_input, init) => {
        expect(new Headers(init?.headers).get("if-none-match")).toBe('"first"')
        return Promise.resolve(new Response(null, { status: 304 }))
      }, target)
      expect(recovered.status).toBe("not-modified")
      expect(recovered.cache?.source.stale).toBe(false)
      expect(recovered.cache?.source.error).toBeUndefined()
      expect(recovered.cache?.source.validated_at).not.toBe(validatedAt)
      expect(await readCopilotPricing(target)).toEqual(recovered.cache)
    } finally {
      await fs.rm(directory, { recursive: true, force: true })
    }
  })
})
