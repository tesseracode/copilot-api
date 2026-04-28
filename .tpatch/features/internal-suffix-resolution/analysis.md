# Analysis: -internal Model Suffix Resolution

## Summary

Some Copilot catalog models have a transient `-internal` suffix (e.g. `claude-opus-4.7-1m-internal`) that will be dropped when the model graduates from preview. Clients request the clean variant (`claude-opus-4.7-1m`) which doesn't exist in the catalog, causing silent fallback to the base model.

## Fix

When resolving a `-1m` variant, try `-1m-internal` as a fallback if `-1m` doesn't exist. Prefer `-1m` when both exist. Becomes a no-op when `-internal` is dropped.

## Files Modified

- `src/lib/model-mapping.ts` — `anthropicToCopilotModelId()` tries `-1m-internal` fallback
- `src/lib/model-mapping.test.ts` — 3 new tests covering resolution paths
