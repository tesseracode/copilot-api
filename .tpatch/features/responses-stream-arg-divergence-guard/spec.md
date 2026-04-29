# Specification: responses-stream-arg-divergence-guard

## Acceptance Criteria

1. `syncToolArguments` returns immediately (yields zero chunks) and leaves `toolCall.arguments` unchanged whenever `nextArguments` is `undefined`, an empty string, or strictly equal to the current accumulator. (Existing behaviour preserved.)

2. When `nextArguments.startsWith(toolCall.arguments)` is true and `nextArguments` is strictly longer, `syncToolArguments` updates the accumulator to `nextArguments` and yields exactly one chunk whose tool-call delta carries `nextArguments.slice(toolCall.arguments.length)` as its `arguments` field. (Existing behaviour preserved.)

3. When `nextArguments` is non-empty and does **not** start with `toolCall.arguments`:
   - `syncToolArguments` yields zero chunks.
   - `toolCall.arguments` is unchanged.
   - A `consola.warn` call is made whose payload includes:
     - `callId` (from `toolCall.callId`)
     - `name` (from `toolCall.name`)
     - `accumulatedLength` (number)
     - `candidateLength` (number)
     - `accumulatedTail` (last 80 chars of accumulator)
     - `candidateHead` (first 80 chars of candidate)
   - Argument bodies are not logged in full. The truncation guards against leaking large user payloads through logs.

4. Both `response.function_call_arguments.done` and `response.output_item.done` event paths exhibit the behaviours above (both route through `syncToolArguments`).

5. New unit tests under `tests/responses-stream-arg-divergence-guard.test.ts` cover:
   - **Identity**: done with `arguments` equal to accumulated streamed deltas → zero chunks emitted.
   - **Extension**: done with `arguments` extending accumulated → exactly one chunk emitted whose delta carries only the suffix.
   - **Divergence**: done with `arguments` whose prefix does not match accumulated → zero chunks emitted, accumulator unchanged, the `consola.warn` is invoked once.
   - **End-to-end correctness on divergence**: piping a divergent stream through `translateChunkToAnthropicEvents` and reassembling `input_json_delta` events yields a parseable JSON object equal to the streamed prefix (not the corrupted concatenation).

6. The new tests use `bun:test` and stub `consola.warn` (e.g. via `spyOn(consola, "warn")`) to verify the warning is emitted on divergence and not in the identity / extension cases.

7. The project passes:

   ```bash
   bun test
   bun run lint
   bun run typecheck
   ```
   with no new typecheck errors over the pre-existing baseline.

## Out of Scope

- Surfacing tool-arg divergence to the client as an error event. Terminal-error surfacing is owned by `responses-stream-error-events`.
- Refactoring `getToolCallDelta` / `getNewToolCallDelta` / the `toolCallsByCallId` / `toolCallsByOutputIndex` indices. Those are unrelated to argument-prefix reconciliation.
- Changing `streamState.toolCallIndex` semantics.

## Implementation Plan

1. Open `src/services/copilot/create-responses.ts` and locate `function* syncToolArguments` at approximately line 514.

2. Confirm `consola` is already imported at the top of the file. If absent, add `import consola from "consola"` (it is currently imported, per `create-responses.ts` line 1, so no change expected).

3. Replace the body of `syncToolArguments` with explicit branching:

   ```ts
   function* syncToolArguments(
     streamState: ResponsesStreamState,
     toolCall: ResponsesStreamToolCall,
     nextArguments: string | undefined,
   ): Generator<ChatCompletionChunk> {
     if (!nextArguments || nextArguments === toolCall.arguments) {
       return
     }

     if (!nextArguments.startsWith(toolCall.arguments)) {
       consola.warn(
         "Tool call argument stream diverged; preserving streamed prefix",
         {
           callId: toolCall.callId,
           name: toolCall.name,
           accumulatedLength: toolCall.arguments.length,
           candidateLength: nextArguments.length,
           accumulatedTail: toolCall.arguments.slice(-80),
           candidateHead: nextArguments.slice(0, 80),
         },
       )
       return
     }

     const missingArguments = nextArguments.slice(toolCall.arguments.length)
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

4. Add `tests/responses-stream-arg-divergence-guard.test.ts`. Drive divergent streams through `translateResponsesStreamEvent` directly to test in isolation; for the end-to-end correctness case, also run the resulting chunks through `translateChunkToAnthropicEvents` and reassemble `input_json_delta` partial_json values.

5. Run `bun test`, `bun run lint`, `bun run typecheck`. The pre-existing typecheck errors documented during feature 1 are acceptable; no new errors should appear.

## Risks

- **Behaviour change for clients that relied on the corrupted-but-tolerated `prefix + candidate` concatenation.** None observed in this codebase; the translation invariant is "accumulate streamed deltas, treat done as confirmation." The change preserves the streamed view, which is the closer approximation to truth.
- **`consola.warn` noise.** Mitigated: the warning fires only on the rare divergent path. Tests assert it is silent on identity/extension cases.
- **Non-Anthropic clients of `/v1/chat/completions` that consume the chunks directly.** Same reasoning: streamed deltas remain authoritative; the divergent path was already producing invalid tool args, so improving correctness is unambiguously the right call.
