# Exploration

- `src/services/copilot/create-responses.ts`: raw Responses type and non-stream/stream translation.
- `src/services/copilot/create-chat-completions.ts`: Chat response extension type.
- `src/routes/messages/non-stream-translation.ts`: Chat→Anthropic output mapping.
- `src/routes/messages/anthropic-types.ts`: Anthropic extension type.
- Existing context probe contains verified nano-AIU arithmetic and cache token examples.
- Tests belong in a dedicated usage-preservation suite.
