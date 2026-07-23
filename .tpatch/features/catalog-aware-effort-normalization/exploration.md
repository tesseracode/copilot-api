# Exploration

- `src/services/copilot/get-models.ts`: catalog capability type needs `reasoning_effort`.
- `src/lib/state.ts`: `state.models` is the existing in-memory catalog; no fetch is needed.
- `src/routes/messages/handler.ts`: Anthropic effort enters Responses routing here.
- `src/routes/chat-completions/handler.ts`: OpenAI effort and current unconditional `medium` default enter Responses here.
- `src/routes/messages/non-stream-translation.ts`: bidirectional effort preservation belongs with other format translation.
- `src/services/copilot/forward-native-messages.ts`: native Claude capability forwarding and legacy thinking-budget fallback.
- `src/services/copilot/create-responses.ts`: consumes an already-resolved effort.
- Unit tests will use synthetic catalogs; the model validator will probe representative live capability differences.
