# Analysis: Per-generation Thinking Type Normalization

## Summary

The Copilot /v1/messages endpoint has different thinking type support across Claude model generations. A single normalization strategy (e.g. always downgrade adaptive→enabled) breaks on newer models. This feature implements per-generation detection and normalization.

## Upstream Status

Not present upstream. The upstream copilot-api has no thinking type normalization at all.

## Compatibility

- No new dependencies
- No breaking changes — existing behavior for older models is preserved
- The generation detection uses an allowlist for older models, defaulting future models to adaptive

## Verified Compatibility Matrix

Probed directly against upstream with 81 API calls (9 models × 9 configurations):

| Generation | disabled | enabled+budget | adaptive | output_config.effort |
|------------|:--------:|:--------------:|:--------:|:--------------------:|
| Older (haiku-4.5, sonnet-4/4.5, opus-4.5) | ✅ | ✅ | ❌ | ❌ |
| 4.6 (sonnet-4.6, opus-4.6[-1m]) | ✅ | ✅ | ✅ | ✅ |
| 4.7 base (opus-4.7) | ✅ | ❌ | ✅ | ❌ |
| 4.7-1m (opus-4.7-1m-internal) | ✅ | ❌ | ✅ | ✅ |

## Key Constraints

- `adaptive` NEVER accepts `budget_tokens` — universally rejected
- `enabled` ALWAYS requires `budget_tokens` — field is mandatory
- `budget_tokens` must be < `max_tokens`
- `output_config.effort` only works on 4.6 and 4.7-1m models
