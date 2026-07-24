# Analysis

Pricing refresh uses `Bun.YAML.parse` in production-loaded code, so the Node bundle fails with `Bun is not defined`. The endpoint also lacks HTTP conditional GET and publishes docs rows outside the accessible account catalog.

Use a direct runtime YAML dependency, preserve stale last-good data correctly, and publish the live-catalog intersection without filtering models that lack prices.
