# Specification: responses-stream-error-events

## Acceptance Criteria

1. **`response.failed` handler.** When `translateResponsesStreamEvent` receives an event with `event: "response.failed"`, it yields exactly one `ChatCompletionChunk` with:
   - `id`, `created`, `model` consistent with the rest of the stream (i.e. via `makeChunk`).
   - `choices[0].delta = {}`, `choices[0].finish_reason = null`.
   - `error = { type: data.response.error.type ?? "api_error", message: data.response.error.message ?? "Upstream response failed" }`.
   - `usage` present if `data.response.usage` was set, otherwise omitted.
   - The handler logs once via `consola.warn` with the error type and message.

2. **`error` (generic SSE) handler.** When `translateResponsesStreamEvent` receives an event with `event: "error"`, it yields exactly one chunk with:
   - `error = { type: data.code ?? "api_error", message: data.message ?? "Upstream error" }`.
   - `code: data.code` populated on the error object if available.
   - Same `id`/`created`/`model`/`finish_reason: null` semantics as criterion (1).
   - The handler logs once via `consola.warn`.

3. **`response.incomplete` handler.** When `translateResponsesStreamEvent` receives an event with `event: "response.incomplete"`, it yields exactly one chunk with:
   - `choices[0].delta = {}`.
   - `choices[0].finish_reason` mapped from `data.response.incomplete_details.reason`:
     - `"max_output_tokens"` → `"length"`.
     - `"content_filter"` → `"content_filter"`.
     - any other or absent → `"stop"`.
   - `usage` present if `data.response.usage` was set.
   - No `error` field. No `consola.warn`.

4. **Anthropic translator passthrough on error chunks.** `translateChunkToAnthropicEvents` detects `chunk.error` and:
   - Emits `message_start` if not yet emitted (preserves the invariant that an Anthropic stream begins with `message_start`).
   - If a content block is open, emits `content_block_stop` for the current `state.contentBlockIndex` and clears `state.contentBlockOpen`.
   - Emits exactly one `AnthropicErrorEvent` whose payload is `{ type: chunk.error.type, message: chunk.error.message }`.
   - Does not emit `message_delta` or `message_stop` for that chunk.
   - Returns immediately after the error event, ignoring any `delta`, `tool_calls`, or `finish_reason` on the same chunk.

5. **Anthropic translator on incomplete chunks.** `response.incomplete` chunks have no `error`, so they flow through the existing terminal path. The mapped `finish_reason` produces the matching Anthropic `stop_reason` via `mapOpenAIStopReasonToAnthropic`.

6. **Schema additions, all optional.**
   - `ChatCompletionChunk.error?: { type: string; message: string; code?: string }`.
   - `ResponsesStreamResponse.error?: { type?: string; message?: string }`.
   - `ResponsesStreamResponse.incomplete_details?: { reason?: string }`.
   - `ResponsesStreamEventData.code?: string`.
   - `ResponsesStreamEventData.message?: string`.
   No fields removed or renamed.

7. **`translateErrorToAnthropicErrorEvent` accepts payload.** New signature:
   ```ts
   export function translateErrorToAnthropicErrorEvent(
     payload?: { type: string; message: string },
   ): AnthropicStreamEventData
   ```
   Default payload preserves the existing behaviour (`type: "api_error"`, generic message). Existing call sites that pass no argument continue to work.

8. **Tests** under `tests/responses-stream-error-events.test.ts`:
   - `response.failed` emits an error chunk with the correct `type` / `message`; piped through `translateChunkToAnthropicEvents`, the resulting events end with one `error` event and zero `message_stop` events; if a content block was open, a `content_block_stop` precedes the error event.
   - generic `error` event behaves analogously, picking up `data.code` and `data.message`.
   - `response.incomplete` with `reason: "max_output_tokens"` produces a chunk with `finish_reason: "length"`; downstream Anthropic events include `message_delta` with `stop_reason: "max_tokens"` and `message_stop`.
   - `response.incomplete` with no reason → `finish_reason: "stop"`.
   - `consola.warn` spy: invoked once for `failed` and `error`; not invoked for `incomplete`.

9. **Lint / typecheck / tests** all pass:
   ```bash
   bun test
   bun run lint
   bun run typecheck
   ```
   No new typecheck errors over the pre-existing baseline.

## Out of Scope

- Emitting OpenAI-spec `event: error` SSE frames in the `/v1/chat/completions` handler. Current chunk-level `error` field is sufficient.
- `data: [DONE]` terminator emission. Pre-existing absence; not regressing.
- Surfacing per-tool-call argument errors (covered by `responses-stream-arg-divergence-guard`).
- Any abort-signal propagation (covered by `responses-stream-abort-propagation`, the next feature).

## Implementation Plan

1. Edit `src/services/copilot/create-chat-completions.ts`:
   - Add optional `error` field to `ChatCompletionChunk`.

2. Edit `src/services/copilot/create-responses.ts`:
   - Extend `ResponsesStreamResponse` with `error?: { type?: string; message?: string }` and `incomplete_details?: { reason?: string }`.
   - Extend `ResponsesStreamEventData` with `code?: string`, `message?: string`.
   - Add a small `mapIncompleteReasonToFinishReason` helper.
   - Add three new generator functions: `handleFailedEvent`, `handleIncompleteEvent`, `handleErrorEvent`. Each builds a chunk via `makeChunk` (passing `usage` where available) and yields it.
   - Add three new cases to the switch in `translateResponsesStreamEvent`: `response.failed`, `response.incomplete`, `error`.

3. Edit `src/routes/messages/stream-translation.ts`:
   - At the top of `translateChunkToAnthropicEvents`, after the `chunk.choices.length === 0` guard, branch on `chunk.error`. Emit `message_start` if needed, emit `content_block_stop` if a block is open, then push a single error event via `translateErrorToAnthropicErrorEvent(chunk.error)` and `return`.
   - Update `translateErrorToAnthropicErrorEvent` signature to accept an optional payload with default.

4. Add `tests/responses-stream-error-events.test.ts` covering the four cases enumerated in criterion (8).

5. Run `bun test`, `bun run lint`, `bun run typecheck` and commit.

## Risks

- **`finish_reason: null` on error chunks** prevents the existing terminal logic from emitting `message_stop` — that's intentional. Verified by test (4) which asserts no `message_stop` follows the error event.
- **Discrimination on `chunk.error`** is by `Object.hasOwn` (simple presence check). Safer than truthy check because `chunk.error` is structured.
- **Order-of-handlers**: error chunks must be checked BEFORE the `messageStartSent` and `delta` paths in `translateChunkToAnthropicEvents`, but AFTER `chunk.choices.length === 0` (which is just a guard). The error chunks have an empty choice with `delta = {}`, so they pass that guard.
