import { createHash } from "node:crypto"

import type { Model } from "~/services/copilot/get-models"

import packageJson from "../../package.json"

/**
 * Identifies proxy-owned translation semantics only. Bump this token when
 * externally observable request or response translation changes. It is
 * deliberately not derived from the package version, and it makes no claim
 * about upstream Copilot behavior.
 */
export const TRANSLATION_CONTRACT = "copilot-api.translation/1"

export const UNKNOWN_MARKER = "unknown"

const REVISION_PATTERN = /^[\w.-]{1,64}$/

/**
 * Build revisions are operator-supplied, so anything that could smuggle header
 * separators, paths or identity is rejected in favour of an explicit unknown.
 */
export function sanitizeRevision(raw: string | undefined): string {
  const trimmed = raw?.trim() ?? ""
  return REVISION_PATTERN.test(trimmed) ? trimmed : UNKNOWN_MARKER
}

export const BUILD_REVISION = sanitizeRevision(
  process.env.COPILOT_API_BUILD_REVISION,
)

export const BUILD_IDENTITY = `${packageJson.version}+${BUILD_REVISION}`

function compareStrings(a: string, b: string): number {
  if (a === b) return 0
  return a < b ? -1 : 1
}

function stableStringify(value: unknown): string {
  if (value === undefined) return "null"
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value)
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`
  }
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, item]) => item !== undefined)
    .sort(([a], [b]) => compareStrings(a, b))
  return `{${entries
    .map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`)
    .join(",")}}`
}

/**
 * Fingerprints only the catalog fields that influence routing, normalized so
 * that upstream response ordering and key ordering cannot change the result.
 * Upstream publishes no catalog version, generation or ETag, so this proxy is
 * the only component able to identify the catalog it actually routed on.
 */
export function catalogFingerprint(models: Array<Model> | undefined): string {
  if (!models || models.length === 0) return UNKNOWN_MARKER

  const normalized = models
    .map((model) => ({
      capabilities: model.capabilities,
      id: model.id,
      supported_endpoints: [...(model.supported_endpoints ?? [])].sort(
        compareStrings,
      ),
    }))
    .sort((a, b) => compareStrings(a.id, b.id))

  return createHash("sha256")
    .update(stableStringify(normalized))
    .digest("hex")
    .slice(0, 16)
}
