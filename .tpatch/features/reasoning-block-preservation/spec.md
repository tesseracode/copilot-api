# Spec: Reasoning Block Preservation

## Acceptance Criteria

1. GPT-5.x `reasoning` output items are extracted and preserved in translation
2. `/chat/completions` responses include `reasoning_text` on the message when reasoning is present
3. `/v1/messages` responses include a `thinking` block before text when reasoning is present
4. `reasoning_tokens` from usage is included in token counts
5. Empty `summary` arrays (current Copilot behavior) produce no reasoning text — just skip gracefully
6. Streaming: `reasoning` events are translated to appropriate deltas for both formats
7. No regression on existing text/tool_call handling

## Out of Scope

- Reasoning block round-tripping in multi-turn (sending reasoning back as input) — requires `item_reference` support
- `encrypted_content` handling — not seen on Copilot yet
- Streaming reasoning deltas — the Copilot `/responses` streaming doesn't emit reasoning events currently

## Files to Modify

- `src/services/copilot/create-responses.ts` — `ResponsesOutputItem` type, `translateResponsesNonStreaming`
- `src/services/copilot/create-chat-completions.ts` — `ResponseMessage` type (add `reasoning_text`)
- `src/routes/messages/non-stream-translation.ts` — `translateToAnthropic` (add thinking block from reasoning)
