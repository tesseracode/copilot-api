# Exploration

- `src/lib/model-mapping.ts`: `MODEL_ID_MAP` and its derived `REVERSE_MODEL_ID_MAP`; the dash-to-dot rule replaces the enumeration in both `anthropicToCopilotModelId` and `copilotToAnthropicModelId`.
- Ordering constraint in `anthropicToCopilotModelId`: `[1m]`/`-1m` stripping and date-suffix reduction run before the version rule, which is why the minor version is bounded to two digits.
- `src/lib/copilot-pricing.ts`: `MODEL_ALIASES` and the lookup at the `grouped.entries()` map, where a display name becomes a model ID and misses land in `unmatched_models`.
- `src/lib/copilot-pricing.ts` `pricingForModel`: only ever queried with live catalog IDs, which is why a derived entry for a nonexistent model is inert.
- `src/routes/models/route.ts`: consumes `pricingForModel` to attach `x_copilot_pricing`, so a missing alias is directly visible to clients.
- `src/lib/state.ts`: the catalog is available but deliberately unused for either transformation, since both are format conventions rather than capabilities.
- `src/lib/model-mapping.test.ts`: existing assertions map `claude-sonnet-4-6` against a catalog that omits it, proving the transformation must not be catalog-gated.
- `tests/copilot-pricing.test.ts`: contains the `reports unmatched model names rather than guessing` test that this feature deliberately reverses.
- Live evidence (2026-09-07): six of eight `MODEL_ID_MAP` targets dead; live Claude models `claude-haiku-4.5`, `claude-opus-4.7`, `claude-opus-4.8`, `claude-opus-5`, `claude-sonnet-5`; pricing coverage measured at 4/14 before and 14/14 after, with `unmatched_models` reduced to the single prose row.
- Pricing source names showing footnote drift: `Gemini 3.6 Flash[^gemini-flash-promo]` gained a marker, `Claude Sonnet 5` lost one.
- Out of scope: catalog gating, filtering models, and the absent-`limits` crash handled by `tolerate-catalog-entries-that-omit-capabilities-limits-the`.
