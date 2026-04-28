# Spec: Per-generation Thinking Type Normalization

## Acceptance Criteria

1. Older models (haiku-4.5, sonnet-4/4.5, opus-4.5) receive `thinking: { type: "enabled", budget_tokens: N }` even when the client sends `adaptive`.
2. 4.6 models pass through `adaptive` or `enabled` as-is, with `budget_tokens` only on `enabled`.
3. 4.7+ models receive `thinking: { type: "adaptive" }` even when the client sends `enabled`.
4. `budget_tokens` is clamped to `max_tokens - 1`.
5. `output_config.effort` is forwarded natively to 4.6 and 4.7-1m models.
6. `output_config.effort` is converted to `budget_tokens` for models that don't support it.
7. `effort: "low"` disables thinking on all models.
8. Future unknown models default to adaptive behavior.

## Files Modified

- `src/services/copilot/forward-native-messages.ts` — `detectGeneration()`, `normalizeThinking()`, `supportsEffort()`, `buildNativeBody()`
