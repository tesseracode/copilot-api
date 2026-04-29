# Analysis: responses-stream-arg-divergence-guard

## Summary

`syncToolArguments` in `src/services/copilot/create-responses.ts` reconciles a tool-call's accumulated streamed arguments against a candidate "full" arguments string that arrives with `response.function_call_arguments.done` and `response.output_item.done`. Today, when the candidate string does **not** begin with the accumulated prefix, the function falls back to treating the entire candidate as the missing tail and emits it as a delta, then overwrites the accumulator. Because the client has already received the previously-streamed prefix as separate deltas, the net effect is `prefix + entireCandidate` on the client side — almost always invalid JSON in tool_use input.

The fix is to detect divergence explicitly: log a warning with both prefixes (truncated for hygiene), preserve the accumulator and the already-streamed view, and emit nothing. This trades a possible "the done event was authoritative" outcome for never corrupting tool_use JSON. In practice the streamed deltas are the authoritative chunks the client builds against; the done event is a redundancy check, so favouring the streamed prefix on disagreement is the safer choice.

## Compatibility

**Status**: compatible

Internal correctness fix. No public API surface change. Behaviour change is limited to the divergent-prefix branch: instead of emitting a corrupting delta, the translator will now no-op and log a warning. Clients that received correctly-streamed deltas continue to see them in full; clients that would previously have received the corrupted concatenation will now see the clean accumulated stream. Existing tests do not exercise the divergent path (verified during the earlier review of `tests/anthropic-response.test.ts`).

## Affected Areas

- `src/services/copilot/create-responses.ts`
  - `function syncToolArguments` (line ~514) — the only function whose body changes.
  - Imports: `consola` is already imported at the top of the file; no new imports needed.
- `tests/responses-stream-stable-ids.test.ts` (existing) — no change.
- New test file under `tests/` covering divergent-prefix and prefix-extending behaviour.

## Acceptance Criteria

1. When a `response.function_call_arguments.done` event arrives with `data.arguments` equal to the accumulated tool-call arguments, the translator emits zero chunks (existing behaviour preserved).
2. When `data.arguments` strictly extends the accumulated prefix (i.e., starts with it), the translator emits exactly the suffix as a delta (existing behaviour preserved).
3. When `data.arguments` does **not** start with the accumulated prefix, the translator:
   - emits zero chunks,
   - leaves `toolCall.arguments` unchanged,
   - logs a warning via `consola.warn` that includes the tool call id (or name as fallback), the accumulated prefix length, the candidate length, and a clearly-labelled truncated snippet of each.
4. The same protections apply to invocations from `response.output_item.done` (which also routes through `syncToolArguments`).
5. A unit test feeds a synthetic stream where the `done` event's `arguments` disagrees with the streamed deltas; the test asserts no extra chunk is emitted, the accumulated arguments equal the streamed prefix, and downstream translation produces a single, parseable `tool_use.input`.
6. A unit test confirms the prefix-extending case still emits exactly the suffix as a delta.
7. The project passes `bun test`, `bun run lint`, and `bun run typecheck` (with no new errors over the pre-existing baseline).

## Implementation Notes

- Replace the ternary inside `syncToolArguments` with explicit branching:
  ```ts
  if (!nextArguments.startsWith(toolCall.arguments)) {
    consola.warn(
      "Tool call argument stream diverged; keeping accumulated prefix",
      { callId: toolCall.callId, name: toolCall.name, accumulatedLength: toolCall.arguments.length, candidateLength: nextArguments.length, accumulatedTail: toolCall.arguments.slice(-80), candidateHead: nextArguments.slice(0, 80) },
    )
    return
  }
  const missingArguments = nextArguments.slice(toolCall.arguments.length)
  toolCall.arguments = nextArguments
  if (!missingArguments) return
  yield makeChunk(...)
  ```
- `consola` is already imported at the top of `create-responses.ts` (line 1). Confirm during `explore`.
- The warning payload should not log full argument bodies — they may contain user data. Truncate to 80 chars at each end as in the snippet above.
- Keep generator semantics (`function*`, `yield`); the early `return` becomes a generator return, which is correct.

## Unresolved Questions

- Should divergent payloads emit an Anthropic-side error event instead of silently swallowing? Likely no — `responses-stream-error-events` (the next feature) covers terminal errors. Argument divergence is a recoverable mid-stream anomaly, not a terminal error.
- Is there value in also recording divergence count on `streamState` for observability? Out of scope; logging is enough for now.
