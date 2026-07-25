# Specification

1. A Claude model sent to `/v1/chat/completions` is forwarded to the upstream
   `/chat/completions` endpoint. It is not rerouted through `/v1/messages`, even when the
   model advertises `/v1/messages` in `supported_endpoints`.
2. Streaming tool calls survive: emitted chunks carry `tool_calls` entries with `id`, `name`,
   a stable `index`, and incremental `function.arguments` deltas.
3. Non-streaming tool calls survive unchanged.
4. Client disconnects propagate: the request `AbortSignal` reaches the upstream fetch on this
   path, and an aborted stream terminates without throwing.
5. `/v1/messages` behaviour is unchanged. Anthropic-shaped clients keep full native
   passthrough, including thinking blocks and native tool calling.
6. `src/services/copilot/forward-native-messages.ts` remains in the codebase and remains used
   by the `/v1/messages` route.
7. `src/routes/chat-completions/handler.ts` contains no Anthropic-to-OpenAI translation. The
   four private helpers (`mapAnthropicFinishReason`, `extractAnthropicContent`,
   `anthropicResponseToOpenAI`, `anthropicEventToOpenAIChunk`) and `handleNativeReroute` are
   gone, along with the imports that served only them.
8. `tests/claude-chat-passthrough.test.ts` covers criteria 1 and 2 end to end through
   `server.request`, and fails against the pre-change implementation.
9. `bun run typecheck`, `bun run lint:all`, `bun test`, and `bun run build` all exit 0, with no
   regression to the existing 202 tests.
