import { describe, it, expect } from "bun:test"

import { filterModels, isInternalModel } from "./filter-models"

describe("isInternalModel", () => {
  it("returns true for IDs containing 'internal'", () => {
    expect(isInternalModel("gpt-internal-v1")).toBe(true)
  })

  it("returns true for IDs starting with 'accounts/'", () => {
    expect(isInternalModel("accounts/my-org/model")).toBe(true)
  })

  it("returns false for normal IDs", () => {
    expect(isInternalModel("gpt-4o")).toBe(false)
  })
})

describe("filterModels", () => {
  const models = [
    { id: "gpt-4o", owned_by: "OpenAI" },
    { id: "internal-preview", owned_by: "OpenAI" },
    { id: "accounts/org/custom", owned_by: "Custom" },
    { id: "claude-sonnet-4", owned_by: "Anthropic" },
  ]

  it("returns all models when no filters", () => {
    expect(filterModels(models, false)).toHaveLength(4)
  })

  it("filters internal models", () => {
    const result = filterModels(models, true)
    expect(result).toHaveLength(2)
    expect(result.map((m) => m.id)).toEqual(["gpt-4o", "claude-sonnet-4"])
  })

  it("filters by vendor", () => {
    const result = filterModels(models, false, "anthropic")
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe("claude-sonnet-4")
  })

  it("combines internal + vendor filters", () => {
    const result = filterModels(models, true, "openai")
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe("gpt-4o")
  })
})
