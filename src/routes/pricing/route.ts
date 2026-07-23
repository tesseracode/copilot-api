import { Hono } from "hono"

import { readCopilotPricing } from "~/lib/copilot-pricing"

export const pricingRoutes = new Hono()

pricingRoutes.get("/", async (c) => {
  const pricing = await readCopilotPricing()
  if (!pricing) {
    return c.json(
      { error: "Copilot pricing cache unavailable; run the pricing updater" },
      503,
    )
  }
  return c.json(pricing)
})
