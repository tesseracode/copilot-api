# Spec: -internal Model Suffix Resolution

## Acceptance Criteria

1. `anthropicToCopilotModelId("claude-opus-4.7", true)` returns `claude-opus-4.7-1m-internal` when only that variant exists.
2. `anthropicToCopilotModelId("claude-opus-4.7[1m]", false)` returns `claude-opus-4.7-1m-internal` when only that variant exists.
3. When both `-1m` and `-1m-internal` exist, `-1m` is preferred.
4. When neither exists, falls back to base model.

## Files Modified

- `src/lib/model-mapping.ts`
- `src/lib/model-mapping.test.ts`
