# Exploration

- `src/lib/streaming.ts`: shared translated-stream abort/error boundary.
- `src/routes/chat-completions/handler.ts`: two OpenAI Chat streaming callers.
- `src/routes/messages/handler.ts`: three Anthropic streaming callers.
- `src/routes/messages/stream-translation.ts`: existing Anthropic error envelope helper.
- `src/routes/responses/route.ts`: raw body passthrough requiring a reader wrapper.
- `tests/streaming-abort-handling.test.ts`: pre-existing characterization and five abort cases.
- `tests/streaming-helpers.test.ts`, `tests/native-responses-route.test.ts`, and `tests/responses-stream-error-events.test.ts`: focused regression seams.
