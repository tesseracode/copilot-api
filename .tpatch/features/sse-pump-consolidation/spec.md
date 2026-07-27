# Specification

1. `src/lib/streaming.ts` exports exactly one `isNonStreaming` and one `streamSSEWithAbort`,
   plus the `isClientAbort` predicate the latter uses.
2. No abort-catch block remains in `src/routes/`. Zero occurrences of
   `err.name === "AbortError"` outside `src/lib/streaming.ts`.
3. No `isNonStreaming` is defined in either handler; both import it.
4. `createAnthropicStreamState()` lives beside `AnthropicStreamState` in
   `src/routes/messages/anthropic-types.ts`, and no handler hand-builds that literal.
5. `isNonStreaming` determines streaming by `Symbol.asyncIterator`, not by an own `choices`
   property. An async iterable that happens to carry `choices` is classified as streaming.
6. Abort-path tests covering all five streaming paths across both handlers pass both before and
   after the consolidation, demonstrating it is behaviour-preserving.
7. `isClientAbort` is exported and covered directly, because route-level tests cannot observe
   the swallow-versus-rethrow decision. Forcing it to return `false` must fail at least one
   test.
8. The silent-truncation behaviour discovered during this work is pinned as a characterization
   test and filed separately; it is not fixed here.
9. `bun run typecheck`, `bun run lint:all`, `bun test`, and `bun run build` all exit 0 with no
   regression to the 216 pre-existing tests.
