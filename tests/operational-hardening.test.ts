import { afterEach, beforeEach, describe, expect, it } from "bun:test"

import {
  BUILD_IDENTITY,
  TRANSLATION_CONTRACT,
  UNKNOWN_MARKER,
} from "~/lib/build-info"
import { state } from "~/lib/state"
import { server } from "~/server"

import packageJson from "../package.json"

const PROVENANCE_HEADERS = [
  "x-copilot-api-translation-contract",
  "x-copilot-api-build",
  "x-copilot-api-catalog",
  "x-copilot-api-catalog-observed-at",
]

describe("operational hardening", () => {
  it("reports the package version from health", async () => {
    const response = await server.request("/health")
    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({
      status: "ok",
      version: packageJson.version,
    })
  })

  it.each(["/health", "/v1/models", "/token"])(
    "does not emit wildcard CORS by default for %s",
    async (path) => {
      const response = await server.request(path, {
        headers: { origin: "https://malicious.example" },
      })
      expect(response.headers.get("access-control-allow-origin")).toBeNull()
    },
  )

  it.each([
    "/v1/responses/resp_123",
    "/responses/resp_123",
    "/v1/conversations",
  ])("does not expose Responses lifecycle route %s", async (path) => {
    const response = await server.request(path)
    expect(response.status).toBe(404)
  })
})

describe("translation contract provenance markers", () => {
  const catalog = {
    object: "list",
    data: [
      {
        id: "gpt-provenance",
        name: "GPT Provenance",
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
      },
    ],
  }

  beforeEach(() => {
    state.models = structuredClone(catalog)
    state.modelsFingerprint = "0123456789abcdef"
    state.modelsObservedAt = "2026-08-13T00:00:00.000Z"
  })

  afterEach(() => {
    state.models = undefined
    state.modelsFingerprint = undefined
    state.modelsObservedAt = undefined
  })

  it.each(["/models", "/v1/models"])(
    "marks %s with provenance",
    async (path) => {
      const response = await server.request(path)
      expect(response.status).toBe(200)
      expect(response.headers.get("x-copilot-api-translation-contract")).toBe(
        TRANSLATION_CONTRACT,
      )
      expect(response.headers.get("x-copilot-api-build")).toBe(BUILD_IDENTITY)
      expect(response.headers.get("x-copilot-api-catalog")).toBe(
        "0123456789abcdef",
      )
      expect(response.headers.get("x-copilot-api-catalog-observed-at")).toBe(
        "2026-08-13T00:00:00.000Z",
      )
    },
  )

  it("emits identical markers on both mounted paths", async () => {
    const [mounted, versioned] = await Promise.all([
      server.request("/models"),
      server.request("/v1/models"),
    ])
    for (const header of PROVENANCE_HEADERS) {
      expect(versioned.headers.get(header)).toBe(mounted.headers.get(header))
    }
  })

  it("reports the package version in the build identity", async () => {
    const response = await server.request("/v1/models")
    expect(response.headers.get("x-copilot-api-build")).toStartWith(
      `${packageJson.version}+`,
    )
  })

  it("leaves the model list body unchanged", async () => {
    const response = await server.request("/v1/models")
    expect(await response.json()).toMatchObject({
      object: "list",
      has_more: false,
      data: [{ id: "gpt-provenance", object: "model" }],
    })
  })

  it("falls back to unknown when no catalog snapshot is recorded", async () => {
    state.modelsFingerprint = undefined
    state.modelsObservedAt = undefined

    const response = await server.request("/v1/models")
    expect(response.headers.get("x-copilot-api-catalog")).toBe(UNKNOWN_MARKER)
    expect(response.headers.get("x-copilot-api-catalog-observed-at")).toBe(
      UNKNOWN_MARKER,
    )
  })

  it("never exposes secrets, identity or per-request counters", async () => {
    state.githubToken = "gho_secret_github_token"
    state.copilotToken = "copilot_secret_token"

    const response = await server.request("/v1/models")
    const rendered = [...response.headers.entries()]
      .map(([name, value]) => `${name}: ${value}`)
      .join("\n")

    expect(rendered).not.toContain("gho_secret_github_token")
    expect(rendered).not.toContain("copilot_secret_token")
    expect(rendered).not.toContain("/Users/")
    expect(rendered.toLowerCase()).not.toContain("uptime")
    expect(rendered.toLowerCase()).not.toContain("exp-assignment")

    state.githubToken = undefined
    state.copilotToken = undefined
  })

  it("keeps markers stable across repeated requests to one snapshot", async () => {
    const first = await server.request("/v1/models")
    const second = await server.request("/v1/models")
    for (const header of PROVENANCE_HEADERS) {
      expect(second.headers.get(header)).toBe(first.headers.get(header))
    }
  })
})
