# Analysis: responses-stream-error-events

## Summary

The `/responses` SSE stream can terminate with three failure-shaped events that the current translator silently drops:

- `response.failed` — the upstream model run failed; payload carries `response.error.{type, message}`.
- `response.incomplete` — the run terminated early but with partial output; payload carries `response.incomplete_details.reason` (e.g. `max_output_tokens`, `content_filter`).
- `error` — a generic SSE-level error event; payload carries `code`, `message`, optional `param`.

`translateResponsesStreamEvent` in `src/services/copilot/create-responses.ts` only switches on success-path event names. Any of the above ends the upstream stream with no `response.completed`, so the proxy emits no terminal `message_delta` / `message_stop` and no Anthropic `error` event. Clients see a stream that just stops mid-message — no `stop_reason`, no error visibility, often a hung or "incomplete" UX.

The fix has two layers:

1. **`/responses` translator (`create-responses.ts`)** — add handlers for the three event types. Failed/error emit a final `ChatCompletionChunk` carrying a new optional `error` field (no `finish_reason`); incomplete emits a normal terminal chunk with `finish_reason: "length"` and usage if present (clean termination, no error semantics).

2. **Anthropic translator (`stream-translation.ts`)** — when the chunk carries `error`, close any open content block, then emit a single `event: error` (using the existing `AnthropicErrorEvent` shape and the existing `translateErrorToAnthropicErrorEvent` helper, extended to accept a payload) instead of the usual `message_delta`/`message_stop`. Per Anthropic SSE spec, `error` is itself a stream terminator.

The change is additive: `ChatCompletionChunk.error` is optional; existing code paths that don't set it are unaffected. `/v1/chat/completions` clients (which receive raw chunks, not Anthropic events) get a chunk with the `error` field — non-standard but ignored by strict OpenAI consumers; the server-side `consola.warn` log is the authoritative debug signal.

## Compatibility

**Status**: compatible

All schema changes are additive optionals. The chunk emitted on error has no `finish_reason`, so existing terminal logic in downstream consumers does not falsely fire. Existing tests do not exercise terminal-error events, so nothing regresses.

## Affected Areas

- `src/services/copilot/create-chat-completions.ts` — extend `ChatCompletionChunk` with optional `error` field.
- `src/services/copilot/create-responses.ts` — extend `ResponsesStreamEventData`, add three handler generators, add three switch cases.
- `src/routes/messages/stream-translation.ts` — short-circuit on `chunk.error`; extend `translateErrorToAnthropicErrorEvent` to accept a payload.
- New test file `tests/responses-stream-error-events.test.ts`.

## Acceptance Criteria

1. When `response.failed` arrives with `data.response.error = { type, message }`, the translator emits a single chunk with `chunk.error = { type, message }` and `finish_reason: null`.
2. When a generic `error` event arrives with `data.code` and `data.message`, the translator emits a single chunk with `chunk.error = { type: data.code ?? "api_error", message: data.message }` and `finish_reason: null`.
3. When `response.incomplete` arrives with `data.response.incomplete_details.reason`, the translator emits one terminal chunk with `finish_reason` mapped from the reason (`max_output_tokens` → `length`, `content_filter` → `content_filter`, anything else → `stop`) and usage if present.
4. The `/v1/messages` Anthropic translator, when given a chunk that carries `error`, emits exactly one Anthropic `error` event whose `error.message` and `error.type` mirror the chunk's error. It does not emit `message_delta` or `message_stop` after an error.
5. If a content block is open when an error chunk arrives, the Anthropic translator closes it (`content_block_stop`) before emitting the `error` event.
6. `consola.warn` is invoked on `response.failed` and on `error`. `response.incomplete` does not warn (it's a clean partial termination).
7. New unit tests cover all three event types end-to-end (chunk emission AND Anthropic event sequence).
8. `bun test`, `bun run lint`, `bun run typecheck` pass with no new errors over the pre-existing baseline.

## Implementation Notes

- The new `chunk.error` field type:
  ```ts
  error?: {
    type: string
    message: string
    code?: string
  }
  ```
- New `ResponsesStreamEventData` fields (all optional): `incomplete_details?: { reason?: string }`, `code?: string`, `message?: string`. The existing `response?: ResponsesStreamResponse` interface gains optional `error?: { type?: string; message?: string }` and `incomplete_details?: { reason?: string }`.
- `translateErrorToAnthropicErrorEvent` becomes:
  ```ts
  export function translateErrorToAnthropicErrorEvent(
    payload: { type: string; message: string } = {
      type: "api_error",
      message: "An unexpected error occurred during streaming.",
    },
  ): AnthropicStreamEventData
  ```
  Existing call sites that pass no argument keep working.
- `incomplete_details.reason` mapping is a small helper; co-locate with the new handler.

## Unresolved Questions

- Whether the `/v1/chat/completions` handler should also emit an explicit `data: [DONE]` after an error chunk. Out of scope; current handler does not emit `[DONE]` and clients tolerate socket close as terminator.
- Whether to surface `response.incomplete_details.reason = "content_filter"` as an Anthropic error rather than a clean stop. Initial mapping treats it as `stop_reason: "content_filter"` (a valid Anthropic stop reason); revisit if downstream UX needs an explicit error.
- Whether `/v1/chat/completions` needs an OpenAI-spec error event (`event: error` SSE frame). Out of scope; the chunk-level `error` field is the documented but rarely-used OpenAI error shape and is enough for the failure mode.
