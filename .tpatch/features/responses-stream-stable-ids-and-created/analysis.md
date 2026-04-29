# Analysis: responses-stream-stable-ids-and-created

## Summary

Stabilise the `id` and `created` fields emitted by the `/responses` → Chat Completions streaming translator. Today, `makeChunk` in `src/services/copilot/create-responses.ts` falls back to a fresh `chatcmpl-${randomUUID()}` on every chunk whenever `streamState.responseId` is still empty, and recomputes `Math.floor(Date.now() / 1000)` on every chunk unconditionally. As a result, chunks belonging to the same logical response can carry different `id` values (until the upstream `response.created` event lands and populates `streamState.responseId`) and always carry drifting `created` timestamps. Clients that key on chunk `id` for assembly or that expect a stable response timestamp see inconsistent values. The fix is to allocate the fallback id once at stream-state creation and freeze `created` at the same moment, then reuse both for the lifetime of the stream.

## Compatibility

**Status**: compatible

This is an internal correctness fix to streaming chunk metadata. It does not change request routing, payload translation semantics, or authentication. The Anthropic translation layer downstream (`translateChunkToAnthropicEvents`) does not depend on chunk `id` or `created` being unstable — it consumes deltas and tool-call state. Existing tests that pin specific id/timestamp values (if any) will need to be updated to reflect the new stable behaviour.

## Affected Areas

- `src/services/copilot/create-responses.ts` (the only file with the bug; `ResponsesStreamState`, `createResponsesStreamState`, `makeChunk`)
- Tests under `src/services/copilot/` (existing `forward-native-messages.test.ts` is unrelated; a new test file or additions to an existing one will cover this)

## Acceptance Criteria

1. For a single `/responses` SSE stream, every emitted `ChatCompletionChunk` carries the same `id` value, regardless of whether `response.created` / `response.in_progress` arrived before the first emitted chunk.
2. For a single stream, every emitted chunk carries the same `created` value (Unix seconds, captured at stream start).
3. When `response.created` does provide an upstream `id`, that id replaces the fallback id from that chunk onward; once adopted, the upstream id is preserved for the rest of the stream and not regenerated.
4. The fallback id format remains `chatcmpl-<uuid>` so downstream consumers see no schema change.
5. A unit test consumes a synthetic `/responses` event sequence in which `response.created` arrives only after several `output_text.delta` events; the test asserts that all emitted chunks share the same `id` and the same `created`.
6. A unit test asserts that when `response.created` arrives first, its `id` is used uniformly across all subsequent chunks.
7. `bun test` and `bun run lint` pass.

## Implementation Notes

- Extend `ResponsesStreamState` with two new fields, e.g. `fallbackId: string` and `created: number`, both populated by `createResponsesStreamState()`. Generate the fallback id with `randomUUID()` once, format as `chatcmpl-<uuid>`. Capture `Math.floor(Date.now() / 1000)` once.
- In `makeChunk`, replace `streamState.responseId || \`chatcmpl-${randomUUID()}\`` with `streamState.responseId || streamState.fallbackId`, and replace `Math.floor(Date.now() / 1000)` with `streamState.created`.
- `syncResponseMetadata` already overwrites `streamState.responseId` only when upstream provides a value, so the "upstream id wins once known" requirement comes for free.
- Keep `randomUUID` imported from `node:crypto` as today; no new dependency.
- Add the new test alongside other service tests in `src/services/copilot/` (or a new `create-responses.test.ts`) using Bun's test runner.

## Unresolved Questions

- Should `created` be captured at `createResponsesStreamState()` call time (i.e., when the handler kicks off) or at the moment the first upstream event is received? Current proposal: at state creation, since that is the closest analog to "stream start" and is deterministic. Worth confirming during `define`.
- Are there any callers that currently rely on per-chunk `created` drift to detect liveness? Survey during `explore`.
- Should the same stabilisation extend to `create-chat-completions.ts` if it exhibits the same pattern? Out of scope for this feature unless trivially co-located; revisit during `explore`.
