# Exploration

Everything to remove lives in one file, `src/routes/chat-completions/handler.ts`:

- `:13` — `import { openaiToAnthropicPayload }` (used only by the reroute).
- `:24-27` — `import { forwardNativeMessagesNonStreaming, forwardNativeMessagesStreaming }`
  (used only by the reroute; the module itself stays for `/v1/messages`).
- `:67-77` — the `if (endpoint === "/v1/messages")` branch in `handleCompletion`, including the
  `resolveEffort` call it performs before delegating. Safe to remove wholesale: `:85-89`
  already assigns `payload.reasoning_effort` on the fall-through path.
- `:178-209` — `handleNativeReroute`.
- `:211-220` — `mapAnthropicFinishReason`.
- `:222-264` — `extractAnthropicContent`.
- `:266-317` — `anthropicResponseToOpenAI`.
- `:319-358` — `anthropicEventToOpenAIChunk`.

Control flow after removal, for a Claude model whose `resolveEndpoint` still returns
`/v1/messages`: the deleted branch no longer matches → `:80` `/responses` does not match →
`:85-89` resolves effort → `:92` `createChatCompletions(payload, signal)`. That path already
passes the signal and already has an abort catch at `:106-115`, so acceptance criterion 4 is
met by subtraction. `resolveEndpoint` itself is not modified: it still reports
`/v1/messages` for Claude, which `/v1/messages`'s own handler continues to rely on.

`resolveEffort` output is safe on this path — upstream accepts `reasoning_effort` for
`claude-sonnet-5` on `/chat/completions` (verified: HTTP 200).

For the test, `tests/native-responses-route.test.ts` is the pattern to copy: it stubs
`globalThis.fetch`, seeds `state`, and drives the app through `server.request(...)`. The new
test must seed `state.models` with a Claude entry whose `supported_endpoints` includes
`/v1/messages`, so it proves the absence of the reroute rather than the absence of the
condition. Assert on the upstream URL the stub received, and on the `tool_calls` deltas in the
emitted SSE body.
