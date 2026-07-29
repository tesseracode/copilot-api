# Exploration

- `src/services/copilot/create-responses.ts`: non-stream output content/status mapping and streaming event switch/state.
- `src/services/copilot/create-chat-completions.ts`: Chat response/delta refusal fields.
- `src/routes/messages/utils.ts`: content_filter currently maps to end_turn.
- `src/routes/messages/non-stream-translation.ts`: Chat refusal text is not converted to Anthropic content.
- `src/routes/messages/stream-translation.ts`: refusal deltas are not handled.
- `src/routes/messages/anthropic-types.ts`: refusal is already a valid stop reason.
- New focused tests cover streaming/non-stream filtering, refusal text, partial content and ordering.
