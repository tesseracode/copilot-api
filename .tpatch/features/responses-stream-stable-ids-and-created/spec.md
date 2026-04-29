# Specification: responses-stream-stable-ids-and-created

## Acceptance Criteria

1. For any single `/responses` SSE stream consumed by `translateResponsesStreamEvent`, every emitted `ChatCompletionChunk` carries the same `id` value.

2. For any single stream, every emitted chunk carries the same `created` value (Unix seconds), captured once at stream-state creation time.

3. When upstream `response.created` (or `response.in_progress` / `response.completed`) supplies a `response.id`, that id replaces the locally-generated fallback id from that chunk forward and is preserved for the rest of the stream. The upstream id is never re-randomised.

4. The fallback id format remains `chatcmpl-<uuid>` to preserve schema compatibility with existing clients.

5. The fallback id is generated exactly once per stream — i.e., once per `createResponsesStreamState()` call — using `randomUUID()` from `node:crypto`.

6. `createResponsesStreamState()` returns a state object that includes the fallback id and the captured `created` timestamp. The exported `ResponsesStreamState` interface is updated to include these fields.

7. `makeChunk` no longer calls `randomUUID()` and no longer reads `Date.now()`; both values are read from the stream state.

8. Public exports (`ResponsesStreamState`, `createResponsesStreamState`, `translateResponsesStreamEvent`) keep their current names and signatures. Adding fields to `ResponsesStreamState` is acceptable; renaming or removing fields is not.

9. Automated tests cover:
   - a synthetic stream where `response.created` arrives only after several `response.output_text.delta` events; all emitted chunks share one stable id and one stable `created`.
   - a synthetic stream where `response.created` arrives first; the upstream id is used uniformly for all subsequent chunks.
   - the fallback id matches the regex `^chatcmpl-[0-9a-f-]{36}$`.

10. The project passes:

    ```bash
    bun test
    bun run lint
    bun run typecheck
    ```

## Out of Scope

- The same id/timestamp drift in `src/services/copilot/create-chat-completions.ts`, if any. This feature only touches the `/responses` translator.
- Changes to how `streamState.model` is populated.
- Any change to the Anthropic event translation layer (`stream-translation.ts`).

## Implementation Plan

1. Open `src/services/copilot/create-responses.ts` and locate:
   - `interface ResponsesStreamState` (around line 292)
   - `function createResponsesStreamState()` (around line 300)
   - `function makeChunk()` (around line 352)

2. Extend `ResponsesStreamState` with two new required fields:

   ```ts
   fallbackId: string
   created: number
   ```

3. Update `createResponsesStreamState()` to populate them once, at the moment the state is created:

   ```ts
   return {
     responseId: "",
     model: "",
     toolCallIndex: 0,
     toolCallsByCallId: {},
     toolCallsByOutputIndex: {},
     fallbackId: `chatcmpl-${randomUUID()}`,
     created: Math.floor(Date.now() / 1000),
   }
   ```

4. Update `makeChunk()` so:
   - `id` becomes `streamState.responseId || streamState.fallbackId`.
   - `created` becomes `streamState.created`.
   - `randomUUID()` is no longer called from `makeChunk()`. The import of `randomUUID` from `node:crypto` is retained because `createResponsesStreamState()` now uses it.

5. `syncResponseMetadata()` already only overwrites `responseId` when upstream provides a value, so requirement (3) is satisfied without additional changes there.

6. Add a new test file `src/services/copilot/create-responses.test.ts` (Bun test runner). Cover:
   - **Late `response.created`**: feed `response.output_text.delta` events first, then `response.created`, then more deltas, then `response.completed`. Collect all emitted chunks and assert `id` and `created` are uniform across the stream.
   - **Early `response.created`**: feed `response.created` first; assert the upstream id is used from chunk 1 onward and that no fallback uuid leaks out.
   - **Fallback id format**: when `response.created` never arrives, every chunk's `id` matches `^chatcmpl-[0-9a-f-]{36}$`.

7. Run `bun test`, `bun run lint`, `bun run typecheck` and address any issues.

## Risks

- **Test runner location**: confirm during `explore` that `bun test` discovers `src/**/*.test.ts`. If the project convention is to place tests under `tests/`, adjust accordingly.
- **External callers of `ResponsesStreamState`**: the type is exported. Adding required fields is technically a breaking change to anyone constructing the state directly. Mitigation: only the in-tree `createResponsesStreamState()` constructs it; verify during `explore` that no other module spreads/recreates this state.
