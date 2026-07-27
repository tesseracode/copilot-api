# Exploration

- `src/lib/error.ts` — `HTTPError`, `badRequest`, `forwardError`. `forwardError` already
  distinguishes a recognised upstream envelope (`isUpstreamErrorEnvelope`) from a raw body; the
  Anthropic variant needs the same split plus the top-level `type` and the status mapping.
- `src/routes/messages/route.ts:10-23` — the two call sites to switch. Both wrap a handler in
  `try/catch` and delegate to `forwardError`.
- `src/routes/chat-completions/route.ts:9-14`, `src/routes/models/route.ts` — keep calling
  `forwardError`; the OpenAI envelope is right for them.
- `src/routes/messages/anthropic-types.ts` — `AnthropicErrorEvent` already declares
  `{ type: "error", error: { type, message } }`. Reuse that shape so the streaming and
  non-streaming error paths agree.
- `src/routes/messages/stream-translation.ts` — `translateErrorToAnthropicErrorEvent` is the
  streaming counterpart and the precedent for the envelope.
- `src/services/copilot/create-responses.ts:103-105` (`requireToolCallId`) and
  `src/routes/messages/non-stream-translation.ts:105` — the two `badRequest` call sites. The
  first is shared with `/chat/completions`, so `badRequest` must not become Anthropic-specific.
- Tests: drive `server.request("/v1/messages", …)` with a mocked `fetch`, as in
  `tests/messages-handler.test.ts`. Cover all four origins — upstream Anthropic envelope,
  upstream non-JSON with a status worth mapping, local `badRequest`, and a local throw.
