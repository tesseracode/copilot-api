# Exploration: responses-stream-stable-ids-and-created

## Files to change

- `src/services/copilot/create-responses.ts` — only production file touched.
  - `interface ResponsesStreamState` (line 292)
  - `function createResponsesStreamState()` (line 300)
  - `function makeChunk()` (line 352)
  - `randomUUID` import (line 3) — already imported, no change.

## Files to add

- `tests/responses-stream-stable-ids.test.ts` — new test file. Convention in this repo places service-level streaming tests under top-level `tests/` (see `tests/anthropic-response.test.ts`, `tests/anthropic-request.test.ts`, `tests/create-chat-completions.test.ts`), not colocated under `src/services/copilot/`. Inline `*.test.ts` exist only for small lib utilities (`src/lib/model-mapping.test.ts`, etc.) and for `src/services/copilot/forward-native-messages.test.ts`.

  Either location works for `bun test`. Choosing `tests/` matches the closest existing analog (`tests/anthropic-response.test.ts` already exercises the `/responses` streaming translator). The implement phase will use `tests/responses-stream-stable-ids.test.ts`.

## Callers of the affected types

Verified by `grep -rn "ResponsesStreamState\|createResponsesStreamState" src tests`:

- `src/services/copilot/create-responses.ts` — definitions and internal use only.
- `src/routes/messages/handler.ts:175` — `const responsesState = createResponsesStreamState()`. Passes the state into `translateResponsesStreamEvent`. Does not read `responseId` / `created` / `fallbackId` itself. Unaffected by adding fields.
- `src/routes/chat-completions/handler.ts:94` — same usage pattern as above. Unaffected.
- `tests/anthropic-response.test.ts:459` — same usage pattern. Existing assertions only check `message.id == "resp-1"` (upstream id) and `message.model`, neither of which depends on the new fields. Unaffected.

No external module spreads, clones, or constructs `ResponsesStreamState` directly. Adding required fields is safe.

## Existing test conventions

- `bun test` discovers `**/*.test.ts` (confirmed by the presence of test files both in `tests/` and inline under `src/`).
- Tests use `bun:test` imports (`import { describe, expect, test } from "bun:test"`). The new test file follows the same convention.
- `tsconfig.json` enables `strict`, `noUnusedLocals`, `noUnusedParameters`, `verbatimModuleSyntax`. Imports must use `import type` where applicable.
- Path alias `~/*` maps to `./src/*`. Tests under `tests/` may use it; `tests/anthropic-response.test.ts` does so already.

## Insertion points (recipe-friendly anchors)

For `replace-in-file` operations the implement phase will use, here are unique anchor strings:

1. **Add fields to `ResponsesStreamState`** — anchor on the full block:
   ```
   export interface ResponsesStreamState {
     responseId: string
     model: string
     toolCallIndex: number
     toolCallsByCallId: Partial<Record<string, ResponsesStreamToolCall>>
     toolCallsByOutputIndex: Partial<Record<number, ResponsesStreamToolCall>>
   }
   ```
   This block is unique in the file.

2. **Add fields to `createResponsesStreamState()` return** — anchor on the full return:
   ```
   export function createResponsesStreamState(): ResponsesStreamState {
     return {
       responseId: "",
       model: "",
       toolCallIndex: 0,
       toolCallsByCallId: {},
       toolCallsByOutputIndex: {},
     }
   }
   ```
   This block is unique in the file.

3. **Replace `makeChunk` body** — anchor on:
   ```
       id: streamState.responseId || `chatcmpl-${randomUUID()}`,
       object: "chat.completion.chunk",
       created: Math.floor(Date.now() / 1000),
   ```
   This three-line sequence is unique.

## Acceptance test outline

The new test at `tests/responses-stream-stable-ids.test.ts` will define three test cases:

1. **`response.created` arrives late** — feed deltas first, then `response.created`, then more deltas, then `response.completed`. Assert all chunks share one `id` and one `created`. The first few chunks use the fallback id; from `response.created` onward, `id == "resp-late"` (upstream id). Acceptance criterion (1) is verified per-chunk-id-equality after the upstream id is adopted; criterion (3) covers the upstream-id-wins behaviour.

2. **`response.created` arrives first** — feed `response.created` then deltas. Every chunk uses upstream id. No chunk should carry a `chatcmpl-...` id.

3. **No `response.created`** — feed only deltas and `response.completed` (without an id). Every chunk uses the fallback id; assert `id` matches `^chatcmpl-[0-9a-f-]{36}$` and is identical across chunks; assert `created` is identical across chunks.

## Tests that must keep passing

- `tests/anthropic-response.test.ts` — entire file. The `Responses API to Anthropic Streaming Response Translation` describe block at line 457 in particular.
- `tests/anthropic-request.test.ts`
- `tests/create-chat-completions.test.ts`
- `src/lib/*.test.ts`
- `src/services/copilot/forward-native-messages.test.ts`

Run all via `bun test`.

## Risks / unknowns resolved

- Test discovery location → resolved: place under `tests/`.
- External callers of the type → resolved: none outside in-tree call sites listed above.
- Existing assertions on chunk id/created → resolved: existing tests assert on upstream id only, which our change preserves.

## Smallest changeset

1. Two added fields in the `ResponsesStreamState` interface.
2. Two added properties in the `createResponsesStreamState()` return literal.
3. Two property updates inside `makeChunk()`.
4. One new test file at `tests/responses-stream-stable-ids.test.ts`.

No other production file is touched.
