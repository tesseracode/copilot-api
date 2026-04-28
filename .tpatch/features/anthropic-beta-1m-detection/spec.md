# Spec: anthropic-beta 1M Context Detection

## Acceptance Criteria

1. A request with `anthropic-beta: context-1m-2025-08-07` header and `model: "claude-opus-4-6"` resolves to `claude-opus-4.6-1m`.
2. A request with the header and `model: "claude-opus-4.7"` resolves to `claude-opus-4.7-1m-internal`.
3. A request without the header uses `state.is1MContext` as fallback.
4. Multiple comma-separated beta values are handled correctly.
5. The `is1M` signal propagates through `buildNativeBody` to `anthropicToCopilotModelId`.

## Files Modified

- `src/routes/messages/handler.ts`
- `src/services/copilot/forward-native-messages.ts`
