import { describe, expect, it } from "bun:test"

import type { ModelsResponse } from "~/services/copilot/get-models"

import { type EffortLevel, resolveEffort } from "./effort"

function catalog(
  modelId: string,
  efforts?: Array<EffortLevel>,
): ModelsResponse {
  return {
    object: "list",
    data: [
      {
        id: modelId,
        name: modelId,
        object: "model",
        vendor: "test",
        version: "1",
        preview: false,
        model_picker_enabled: true,
        capabilities: {
          family: modelId,
          limits: {},
          object: "model_capabilities",
          supports: { reasoning_effort: efforts },
          tokenizer: "test",
          type: "chat",
        },
      },
    ],
  }
}

describe("resolveEffort", () => {
  it("preserves exact supported values", () => {
    expect(
      resolveEffort({
        modelId: "gpt-5.6-sol",
        requested: "max",
        cachedModels: catalog("gpt-5.6-sol", [
          "none",
          "low",
          "medium",
          "high",
          "xhigh",
          "max",
        ]),
      }),
    ).toBe("max")
  })

  it("falls back to the strongest supported effort below the request", () => {
    expect(
      resolveEffort({
        modelId: "gpt-5.5",
        requested: "max",
        cachedModels: catalog("gpt-5.5", [
          "none",
          "low",
          "medium",
          "high",
          "xhigh",
        ]),
      }),
    ).toBe("xhigh")
    expect(
      resolveEffort({
        modelId: "claude-opus-4.6",
        requested: "xhigh",
        cachedModels: catalog("claude-opus-4.6", [
          "low",
          "medium",
          "high",
          "max",
        ]),
      }),
    ).toBe("high")
  })

  it("uses the model floor when the request is weaker than every supported value", () => {
    expect(
      resolveEffort({
        modelId: "gemini-3.5-flash",
        requested: "none",
        cachedModels: catalog("gemini-3.5-flash", [
          "minimal",
          "low",
          "medium",
          "high",
        ]),
      }),
    ).toBe("minimal")
  })

  it("treats auto and omission as the supplied route default", () => {
    const models = catalog("gpt-5.5", [
      "none",
      "low",
      "medium",
      "high",
      "xhigh",
    ])
    expect(
      resolveEffort({
        modelId: "gpt-5.5",
        requested: "auto",
        cachedModels: models,
        defaultEffort: "medium",
      }),
    ).toBe("medium")
    expect(
      resolveEffort({
        modelId: "gpt-5.5",
        cachedModels: models,
        defaultEffort: "medium",
      }),
    ).toBe("medium")
    expect(
      resolveEffort({
        modelId: "gpt-5.5",
        requested: "auto",
        cachedModels: models,
      }),
    ).toBeUndefined()
  })

  it("omits effort for a known model without the capability", () => {
    expect(
      resolveEffort({
        modelId: "legacy",
        requested: "high",
        cachedModels: catalog("legacy"),
      }),
    ).toBeUndefined()
  })

  it("preserves a recognized effort when catalog data is unavailable", () => {
    expect(resolveEffort({ modelId: "unknown", requested: "high" })).toBe(
      "high",
    )
    expect(
      resolveEffort({
        modelId: "unknown",
        requested: "max",
        cachedModels: { data: [] },
      }),
    ).toBe("max")
  })

  it("rejects unknown effort strings", () => {
    expect(
      resolveEffort({ modelId: "gpt-5.6-sol", requested: "extreme" }),
    ).toBeUndefined()
  })

  it("omits effort when the catalog advertises only unknown values", () => {
    const models = catalog("future", ["high"])
    models.data[0].capabilities.supports.reasoning_effort = [
      "extreme" as EffortLevel,
    ]

    expect(
      resolveEffort({
        modelId: "future",
        requested: "high",
        cachedModels: models,
      }),
    ).toBeUndefined()
  })
})
