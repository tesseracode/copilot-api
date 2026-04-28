# Exploration: native-payload-sanitization

## Current State After Parallel Agent Changes

The other agent refactored `buildNativeBody()` in `forward-native-messages.ts` and **reverted both our fixes**:

### What was lost

1. **stop_sequences sanitization** — `stop_sequences` is now in the `OPTIONAL_FIELDS` array (line 33) and gets forwarded as-is, no whitespace filtering. The Buddy `['\n']` bug is back.
2. **effort → thinking mapping** — completely removed. `output_config` is not referenced in `buildNativeBody()`. The `output_config` type still exists in `anthropic-types.ts:26` but is unused.

### What the other agent added (keep)

- Extracted `normalizeThinking()` helper (lines 12-27) — clean, handles adaptive → enabled
- `OPTIONAL_FIELDS` array (lines 30-40) — cleaner than individual if statements
- Same overall allowlist approach we wanted

### Insertion Points

**stop_sequences fix:** After the `OPTIONAL_FIELDS` loop (line 66), add sanitization:
```
// After line 66, before thinking normalization:
if (body.stop_sequences) {
  const filtered = (body.stop_sequences as string[]).filter((s: string) => s.trim())
  if (filtered.length > 0) {
    body.stop_sequences = filtered
  } else {
    delete body.stop_sequences
  }
}
```

**effort mapping:** Modify `normalizeThinking()` (line 15) to accept an optional `effort` parameter, or add effort logic after the thinking normalization at line 69. The cleaner approach: add effort handling in `buildNativeBody()` after the `normalizeThinking` call, reading from `payload.output_config?.effort`.

### Key Symbols

- `buildNativeBody()` — `src/services/copilot/forward-native-messages.ts:48`
- `normalizeThinking()` — `src/services/copilot/forward-native-messages.ts:15`
- `OPTIONAL_FIELDS` — `src/services/copilot/forward-native-messages.ts:30`
- `AnthropicMessagesPayload.output_config` — `src/routes/messages/anthropic-types.ts:26`

### Files to Change

- `src/services/copilot/forward-native-messages.ts` — add stop_sequences filtering + effort mapping
- `src/routes/messages/anthropic-types.ts` — no changes needed (type already has `output_config`)

### Tests That Must Pass

- `npx tsc --noEmit` (configured test_command)
- Unit tests to be added by `three-tier-routing-tests` feature
