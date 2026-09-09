# Analysis

`pricingNameToModelId` strips markdown footnote markers, which makes the transformation many-to-one: `Claude Sonnet 5` and `Claude Sonnet 5[^sonnet-5-promo]` both reduce to `claude-sonnet-5`. Rows are grouped by raw display name, so two variants of one name survive as two separate groups and each derives the same identifier.

The consequence was measured rather than reasoned about. Parsing a two-row source produced two `data` entries both carrying `model: "claude-sonnet-5"`. `pricingForModel` uses `.find()`, so it silently returned the first row's price and the second became unreachable. `publishCopilotPricing` uses `.filter()`, so it emitted **both** rows — a catalog containing duplicate model IDs, which a downstream consumer rejects and which violates an `(etag, model_id)` uniqueness constraint in persistence.

Choosing a winner is not a safe alternative. The whole reason two variants coexist is that they carry different prices: a promotion row is often `$0.00` against a standard row's real rate. Silently selecting either publishes a confident wrong price, which is worse than publishing none, because a client cannot tell that the number is arbitrary. Refusing both and reporting them keeps the failure visible and leaves the operator with an accurate signal.

This is a defect I introduced in `8655580`, when enumerated aliases were replaced by derivation. The derivation fixed a real and larger problem — ten live models had no pricing, two of them regressions caused by footnote drift — but it traded exact-match safety for coverage without guarding the many-to-one case that footnote stripping creates. The guard restores that safety without giving up the coverage.

Scope is bounded by measurement. The current pricing table produces 30 entries with zero duplicate identifiers, so no collision exists in production today and this is a latent defect rather than an active outage. The mechanism is nonetheless plausible on the same evidence that motivated derivation: footnote markers were observed appearing on `Gemini 3.6 Flash` and disappearing from `Claude Sonnet 5`, so a transition that lists both forms briefly is the natural trigger.

Repeated identical display names are unaffected, because those are the multi-tier rows the existing grouping already merges by exact name into one entry with `default` and `long-context` tiers. Only *distinct* names that collide after derivation are refused, which the live table confirms is currently none.

## Follow-up: the publish boundary must re-check (2026-09-09)

A parallel review in an isolated checkout produced an equivalent parse-time guard, and comparing the two exposed a gap in both. The parse guard cannot help a cache that was already written to disk by the pre-fix code, and `readCopilotPricing` loads exactly such a file from `~/.local/share/copilot-api/copilot_pricing.json`.

Feeding a hand-built stale cache to `publishCopilotPricing` reproduced the original failure in full: two rows sharing `claude-sonnet-5` were published, and `mapped_but_inaccessible` reported the ID twice. The other review deduplicated the diagnostic but left the published rows duplicated, so neither implementation closed the path that actually reaches a consumer.

The boundary now re-derives duplicates from `cache.data` and drops every copy, matching the parse-time decision rather than trusting an upstream stage. Unambiguous entries in the same cache are unaffected, so an operator upgrading with a poisoned cache loses only the genuinely ambiguous rows and regains them on the next refresh.
