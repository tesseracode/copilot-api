#!/usr/bin/env bun

import { updateCopilotPricing } from "~/lib/copilot-pricing"

const result = await updateCopilotPricing()
console.log(
  JSON.stringify(
    {
      status: result.status,
      source: result.cache?.source,
      models: result.cache?.data.length ?? 0,
      unmatched_models: result.cache?.unmatched_models ?? [],
    },
    null,
    2,
  ),
)
