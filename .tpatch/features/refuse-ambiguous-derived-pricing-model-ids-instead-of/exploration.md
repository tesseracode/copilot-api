# Exploration

- `src/lib/copilot-pricing.ts` `pricingNameToModelId`: strips `[^...]` footnotes, which is the many-to-one step that makes collisions possible.
- `src/lib/copilot-pricing.ts` `parseCopilotPricingYaml`: groups rows by raw display name, so two footnote variants remain separate groups; the collision pre-pass and the `model` assignment both live here.
- `src/lib/copilot-pricing.ts` `pricingForModel`: `.find()` semantics are why a duplicate silently shadowed rather than erroring.
- `src/lib/copilot-pricing.ts` `publishCopilotPricing`: `.filter()` semantics are why both duplicates reached the published catalog, and why the downstream uniqueness constraint was at risk.
- `MODEL_ALIASES`: an explicit alias can also collide with a derived name, so the pre-pass resolves aliases before checking.
- `src/routes/models/route.ts` and `src/routes/pricing/route.ts`: the consumers that would have served the duplicate rows.
- `tests/copilot-pricing.test.ts`: existing multi-tier and unmatched-diagnostic expectations that must keep passing, plus the new collision cases.
- Measured evidence (2026-09-09): a two-row source produced two entries both claiming `claude-sonnet-5`, `pricingForModel` returned the first price, and `publishCopilotPricing` emitted two rows; the live table produces 30 entries with zero duplicates, so the defect is latent.
- Prior evidence motivating derivation (2026-08-17): footnote markers observed appearing on `Gemini 3.6 Flash` and disappearing from `Claude Sonnet 5`.
- Out of scope: reverting to enumerated aliases, choosing a winner among colliding rows, and any change to tier grouping.
