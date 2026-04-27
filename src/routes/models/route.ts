import { Hono } from "hono"

import { forwardError } from "~/lib/error"
import { filterModels } from "~/lib/filter-models"
import { state } from "~/lib/state"
import { cacheModels } from "~/lib/utils"

export const modelRoutes = new Hono()

modelRoutes.get("/", async (c) => {
  try {
    if (!state.models) {
      // This should be handled by startup logic, but as a fallback.
      await cacheModels()
    }

    const allModels =
      state.models?.data.map((model) => ({
        id: model.id,
        object: "model",
        type: "model",
        created: 0, // No date available from source
        created_at: new Date(0).toISOString(), // No date available from source
        owned_by: model.vendor,
        display_name: model.name,
        capabilities: model.capabilities,
        supported_endpoints: model.supported_endpoints,
        preview: model.preview,
        model_picker_enabled: model.model_picker_enabled,
      })) ?? []

    const models = filterModels(
      allModels,
      state.hideInternal,
      state.modelFilter,
    )

    return c.json({
      object: "list",
      data: models,
      has_more: false,
    })
  } catch (error) {
    return await forwardError(c, error)
  }
})
