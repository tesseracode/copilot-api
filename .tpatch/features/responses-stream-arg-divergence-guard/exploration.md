# Exploration: responses-stream-arg-divergence-guard

## Files to change

- `src/services/copilot/create-responses.ts`
  - `function* syncToolArguments` (line 514–538) — body replaced.
  - Imports: `consola` already imported at line 1. No new imports.

## Files to add

- `tests/responses-stream-arg-divergence-guard.test.ts` — new test file. Same convention as feature 1 (top-level `tests/`, Bun runner, `~/*` path alias).

## Callers of `syncToolArguments`

Verified by `grep -n "syncToolArguments" src/services/copilot/create-responses.ts`:

- `handleFunctionCallArgumentsDoneEvent` (around line 627) — feeds `data.arguments` (the upstream-supplied full string).
- `handleOutputItemDoneEvent` (around line 671) — feeds `data.item.arguments` (same shape, different upstream event).

Both paths consume identical semantics, so a single fix in `syncToolArguments` covers both. No call sites outside this file.

## Existing tests touching tool-call argument streaming

- `tests/anthropic-response.test.ts:457` — `Responses API to Anthropic Streaming Response Translation` describe block. Asserts identity/extension paths via two `function_call_arguments.delta` events plus a `function_call_arguments.done` whose `arguments` extends the deltas. Does **not** exercise the divergent branch. Will continue to pass.
- `tests/responses-stream-stable-ids.test.ts` (new from feature 1) — does not touch tool-call args.

No existing test will need adjustment.

## Insertion points (recipe-friendly anchors)

For the `replace-in-file` operation, the anchor is the full current body of `syncToolArguments`:

```
function* syncToolArguments(
  streamState: ResponsesStreamState,
  toolCall: ResponsesStreamToolCall,
  nextArguments: string | undefined,
): Generator<ChatCompletionChunk> {
  if (!nextArguments || nextArguments === toolCall.arguments) {
    return
  }

  const missingArguments =
    nextArguments.startsWith(toolCall.arguments) ?
      nextArguments.slice(toolCall.arguments.length)
    : nextArguments

  toolCall.arguments = nextArguments

  if (!missingArguments) {
    return
  }

  yield makeChunk(streamState, {
    delta: getToolCallDelta(toolCall, missingArguments),
    finishReason: null,
  })
}
```

This block is unique in the file (only one `syncToolArguments` definition).

## Acceptance test outline

`tests/responses-stream-arg-divergence-guard.test.ts` will define the following cases:

1. **Identity (no-op on done)**: feed `output_item.added` (registers the tool call), three `function_call_arguments.delta` events totalling a JSON string `'{"x":"hello"}'`, then `function_call_arguments.done` with `arguments: '{"x":"hello"}'`. Assert no extra chunk is emitted by the done event (only the `output_item.done` summary chunk, which is its own path).

2. **Extension**: same setup but the deltas total `'{"x":"hel'` and the done event carries `'{"x":"hello"}'`. Assert exactly one chunk emitted by the done step, whose tool-call delta carries `'lo"}'`.

3. **Divergence (warn + no-op)**: deltas total `'{"x":"hello"}'` and the done event carries `'{"y":"world"}'`. Spy on `consola.warn`. Assert: zero chunks from the done step, accumulator unchanged (verified by piping subsequent chunks and observing args remain `'{"x":"hello"}'`), `consola.warn` invoked exactly once with payload containing `callId`, `name`, `accumulatedLength`, `candidateLength`, `accumulatedTail`, `candidateHead`.

4. **End-to-end correctness on divergence**: same divergent stream as (3), but pipe all emitted chunks through `translateChunkToAnthropicEvents` and reassemble `input_json_delta.partial_json` values into a string. Assert the reassembled string equals `'{"x":"hello"}'` and `JSON.parse` yields `{x: "hello"}`.

5. **No warn on identity/extension**: spy on `consola.warn` and assert it is **not** called in cases (1) and (2).

## Tests that must keep passing

- `tests/anthropic-response.test.ts` — full file (especially the streaming describe at line 457).
- `tests/responses-stream-stable-ids.test.ts` — feature 1's tests.
- `tests/anthropic-request.test.ts`, `tests/create-chat-completions.test.ts`.
- `src/lib/*.test.ts`, `src/services/copilot/forward-native-messages.test.ts`.

Run all via `bun test`.

## Smallest changeset

1. One `replace-in-file` op against `src/services/copilot/create-responses.ts` replacing the body of `syncToolArguments`.
2. One `write-file` op creating `tests/responses-stream-arg-divergence-guard.test.ts`.

No other production file is touched.
