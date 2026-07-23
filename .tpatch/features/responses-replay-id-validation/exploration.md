# Exploration

- `src/services/copilot/create-responses.ts`
  - `translateMessages` creates Responses `function_call` and `function_call_output` input items.
  - The smallest insertion points are the two assignments to `call_id`.
- `tests/responses-effort-forwarding.test.ts`
  - Already exercises exported `translateRequestToResponses`; add valid replay and malformed-ID cases here.
- `scripts/proxy-model-validation.ts`
  - `runTranslationTests` owns proxy-specific compatibility probes; add malformed chat-history requests here.
- `src/routes/messages/non-stream-translation.ts`
  - Existing Anthropic `tool_result` validation establishes the local `badRequest` convention.

Validation includes focused unit tests, the full Bun suite, lint, script compilation, and a live valid GPT-5.6-sol replay through `/v1/chat/completions`.
