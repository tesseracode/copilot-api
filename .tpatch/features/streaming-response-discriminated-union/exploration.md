# Exploration

- `src/services/copilot/create-chat-completions.ts`: inferred Chat object/stream union.
- `src/services/copilot/create-responses.ts`: inferred translated object/stream union.
- `src/routes/chat-completions/handler.ts`: two consumers.
- `src/routes/messages/handler.ts`: two consumers.
- `src/lib/streaming.ts`: current Symbol.asyncIterator predicate.
- `tests/streaming-helpers.test.ts`: predicate coverage to remove after migration.
- Existing route, abort, terminal error and usage tests pin wire behavior.
