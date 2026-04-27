# Spec: native-payload-sanitization

## Problem Statement

The `/v1/messages` passthrough forwards payloads that Copilot's endpoint rejects:
1. Whitespace-only `stop_sequences` entries cause `"each stop sequence must contain non-whitespace"`
2. `output_config.effort` signal is silently dropped, losing the user's intent for reasoning depth

## Acceptance Criteria

1. Sending `stop_sequences: ['\n']` through the proxy does NOT return a 400 error
2. Sending `stop_sequences: ['\n', 'END']` results in only `['END']` being forwarded
3. Sending `stop_sequences` where ALL entries are whitespace-only results in the field being removed entirely
4. Sending `output_config: { effort: 'low' }` results in `thinking: { type: 'disabled' }`
5. Sending `output_config: { effort: 'medium' }` sets thinking budget to ~50% of max_tokens
6. Sending `output_config: { effort: 'high' }` sets thinking budget to ~80% of max_tokens
7. Sending `output_config: { effort: 'max' }` sets thinking budget to max_tokens - 1
8. `output_config` is never forwarded to Copilot (already handled by allowlist)
9. Existing thinking config is preserved when no effort is specified
10. `npx tsc --noEmit` passes with no new errors

## Out of Scope

- Replicating first-party effort behavior beyond thinking budget (non-thinking output quality adjustments)
- Supporting `output_config.task_budget` or `output_config.format`
- Changes to the `/chat/completions` or `/responses` translation paths

## Implementation Plan

### Phase 1: Type update
- Add `output_config` to `AnthropicMessagesPayload` in `src/routes/messages/anthropic-types.ts`

### Phase 2: Sanitization logic
- In `buildNativeBody()` at `src/services/copilot/forward-native-messages.ts`:
  - Filter whitespace-only entries from `stop_sequences` before forwarding
  - Read `output_config.effort` and map to thinking budget
  - Integrate with existing thinking normalization (adaptive → enabled)
