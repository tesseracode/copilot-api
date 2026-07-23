# Exploration

- Canonical source: `github/docs/data/tables/copilot/models-and-pricing.yml`.
- `src/lib/paths.ts`: app data directory for cache storage.
- `src/routes/models/route.ts`: model metadata extension point.
- `src/server.ts`: pricing route aliases.
- `src/services/copilot/get-models.ts`: add upstream picker category typing.
- New parser/cache: `src/lib/copilot-pricing.ts`.
- One-shot updater: `scripts/update-copilot-pricing.ts`.
- Fixture-driven tests: `tests/copilot-pricing.test.ts`.
