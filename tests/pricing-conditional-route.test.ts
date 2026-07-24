import { beforeEach, describe, expect, it } from "bun:test"

import {
  parseCopilotPricingYaml,
  type PublishedPricing,
  writeCopilotPricing,
} from "~/lib/copilot-pricing"
import { state } from "~/lib/state"
import { server } from "~/server"

const fixture = `
- model: GPT-5.6 Sol
  input: $5.00
  output: $30.00
- model: Claude Fable 5
  input: $1.00
  output: $5.00
`

beforeEach(async () => {
  state.models = {
    object: "list",
    data: [
      {
        id: "gpt-5.6-sol",
        name: "GPT-5.6 Sol",
        object: "model",
        vendor: "openai",
        version: "1",
        preview: false,
        model_picker_enabled: true,
        capabilities: {
          family: "gpt",
          limits: {},
          object: "model_capabilities",
          supports: {},
          tokenizer: "test",
          type: "chat",
        },
      },
      {
        id: "unpriced-model",
        name: "Unpriced",
        object: "model",
        vendor: "test",
        version: "1",
        preview: false,
        model_picker_enabled: true,
        capabilities: {
          family: "test",
          limits: {},
          object: "model_capabilities",
          supports: {},
          tokenizer: "test",
          type: "chat",
        },
      },
    ],
  }
  await writeCopilotPricing(parseCopilotPricingYaml(fixture))
})

describe("pricing conditional HTTP contract", () => {
  it("returns a representation ETag matching the body", async () => {
    const response = await server.request("/v1/pricing")
    const body = (await response.json()) as PublishedPricing

    expect(response.status).toBe(200)
    expect(response.headers.get("etag")).toBe(body.source.public_etag ?? null)
    expect(body.data.map((item) => item.model)).toEqual(["gpt-5.6-sol"])
    expect(body.diagnostics.accessible_without_pricing).toContain(
      "unpriced-model",
    )
  })

  it("returns bodyless 304 for a matching weak ETag", async () => {
    const initial = await server.request("/v1/pricing")
    const etag = initial.headers.get("etag")
    if (!etag) throw new Error("Expected ETag")

    const response = await server.request("/v1/pricing", {
      headers: { "if-none-match": `W/${etag}` },
    })

    expect(response.status).toBe(304)
    expect(response.headers.get("etag")).toBe(etag)
    expect(await response.text()).toBe("")
  })
})
