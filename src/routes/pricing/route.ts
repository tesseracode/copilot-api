import { Hono } from "hono"

import {
  pricingEtagMatches,
  publishCopilotPricing,
  readCopilotPricing,
} from "~/lib/copilot-pricing"
import { state } from "~/lib/state"

export const pricingRoutes = new Hono()

pricingRoutes.get("/", async (c) => {
  const pricing = await readCopilotPricing()
  if (!pricing) {
    return c.json(
      { error: "Copilot pricing cache unavailable; run the pricing updater" },
      503,
    )
  }
  const published = publishCopilotPricing(pricing, state.models)
  const etag = published.source.public_etag
  if (!etag) return c.json(published)
  c.header("ETag", etag)
  c.header("Cache-Control", "private, max-age=1800")
  if (pricingEtagMatches(c.req.header("if-none-match"), etag)) {
    return c.body(null, 304)
  }
  return c.json(published)
})
