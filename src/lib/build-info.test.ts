import { describe, expect, it } from "bun:test"

import type { Model } from "~/services/copilot/get-models"

import packageJson from "../../package.json"
import {
  BUILD_IDENTITY,
  catalogFingerprint,
  sanitizeRevision,
  TRANSLATION_CONTRACT,
  UNKNOWN_MARKER,
} from "./build-info"

function model(overrides: Partial<Model> = {}): Model {
  return {
    id: "gpt-test",
    name: "GPT Test",
    object: "model",
    vendor: "openai",
    version: "1",
    preview: false,
    model_picker_enabled: true,
    supported_endpoints: ["/responses"],
    capabilities: {
      family: "gpt",
      limits: { max_output_tokens: 128 },
      object: "model_capabilities",
      supports: { tool_calls: true },
      tokenizer: "test",
      type: "chat",
    },
    ...overrides,
  }
}

describe("build revision sanitization", () => {
  it.each([undefined, "", "   "])("falls back to unknown for %p", (raw) => {
    expect(sanitizeRevision(raw)).toBe(UNKNOWN_MARKER)
  })

  it.each(["abc1234", "1.2.3", "v0.7.0-rc.1", "a".repeat(64)])(
    "accepts the safe revision %p",
    (raw) => {
      expect(sanitizeRevision(raw)).toBe(raw)
    },
  )

  it("trims surrounding whitespace", () => {
    expect(sanitizeRevision("  abc1234  ")).toBe("abc1234")
  })

  it.each([
    "a".repeat(65),
    "has space",
    "semi;colon",
    "new\nline",
    "/etc/passwd",
    "user@example.com",
    "ghp_secrettokenvalue!",
  ])("rejects the unsafe revision %p", (raw) => {
    expect(sanitizeRevision(raw)).toBe(UNKNOWN_MARKER)
  })

  it("reports the package version alongside the revision", () => {
    expect(BUILD_IDENTITY.startsWith(`${packageJson.version}+`)).toBe(true)
  })
})

describe("translation contract token", () => {
  it("is a stable constant that is not the package version", () => {
    expect(TRANSLATION_CONTRACT).toBe("copilot-api.translation/1")
    expect(TRANSLATION_CONTRACT).not.toContain(packageJson.version)
  })
})

describe("catalog fingerprint", () => {
  it("returns unknown when no catalog is loaded", () => {
    expect(catalogFingerprint(undefined)).toBe(UNKNOWN_MARKER)
    expect(catalogFingerprint([])).toBe(UNKNOWN_MARKER)
  })

  it("is stable for the same catalog content", () => {
    const first = catalogFingerprint([model({ id: "a" }), model({ id: "b" })])
    const second = catalogFingerprint([model({ id: "a" }), model({ id: "b" })])
    expect(first).toBe(second)
  })

  it("ignores upstream response ordering", () => {
    const ordered = catalogFingerprint([model({ id: "a" }), model({ id: "b" })])
    const reversed = catalogFingerprint([
      model({ id: "b" }),
      model({ id: "a" }),
    ])
    expect(reversed).toBe(ordered)
  })

  it("ignores endpoint ordering within a model", () => {
    const ordered = catalogFingerprint([
      model({ supported_endpoints: ["/chat/completions", "/responses"] }),
    ])
    const reversed = catalogFingerprint([
      model({ supported_endpoints: ["/responses", "/chat/completions"] }),
    ])
    expect(reversed).toBe(ordered)
  })

  it("ignores fields that do not affect routing", () => {
    const base = catalogFingerprint([model()])
    const noisy = catalogFingerprint([
      model({
        name: "Renamed",
        preview: true,
        model_picker_enabled: false,
        model_picker_category: "powerful",
        version: "2",
      }),
    ])
    expect(noisy).toBe(base)
  })

  it("changes when a model is added", () => {
    const before = catalogFingerprint([model({ id: "a" })])
    const after = catalogFingerprint([model({ id: "a" }), model({ id: "b" })])
    expect(after).not.toBe(before)
  })

  it("changes when supported endpoints change", () => {
    const before = catalogFingerprint([
      model({ supported_endpoints: ["/responses"] }),
    ])
    const after = catalogFingerprint([
      model({ supported_endpoints: ["/chat/completions"] }),
    ])
    expect(after).not.toBe(before)
  })

  it("changes when capabilities change", () => {
    const before = catalogFingerprint([model()])
    const after = catalogFingerprint([
      model({
        capabilities: {
          family: "gpt",
          limits: { max_output_tokens: 256 },
          object: "model_capabilities",
          supports: { tool_calls: true },
          tokenizer: "test",
          type: "chat",
        },
      }),
    ])
    expect(after).not.toBe(before)
  })

  it("is a one-way digest that leaks no catalog content", () => {
    const fingerprint = catalogFingerprint([model({ id: "secret-model" })])
    expect(fingerprint).toMatch(/^[0-9a-f]{16}$/)
    expect(fingerprint).not.toContain("secret-model")
  })
})
