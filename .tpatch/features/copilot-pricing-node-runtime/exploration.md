# Exploration

- `src/lib/copilot-pricing.ts`: Bun-only YAML call, cache timestamps, alias diagnostics.
- `src/services/copilot/pricing-scheduler.ts`: 30-minute startup scheduler.
- `src/routes/pricing/route.ts`: add catalog filtering and HTTP conditional caching.
- `src/routes/models/route.ts`: pricing remains optional per model.
- `src/start.ts`: models must be available before first published pricing intersection.
- Add direct `yaml` dependency and production Node integration coverage.
