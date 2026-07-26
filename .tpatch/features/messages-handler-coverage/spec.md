# Specification

1. `tests/messages-handler.test.ts` drives `src/routes/messages/handler.ts` through
   `server.request("/v1/messages", ...)` with `globalThis.fetch` mocked. No production code
   changes.
2. Tier A — a Claude model routes to the upstream `/v1/messages` endpoint, covered
   non-streaming and streaming.
3. Tier B — a model advertising `/responses` routes there and its result is returned in
   Anthropic shape, covered non-streaming and streaming.
4. Tier C — a model advertising only `/chat/completions` routes there and its result is
   returned in Anthropic shape, covered non-streaming and streaming.
5. For each of the three tiers, a test asserts the request's `AbortSignal` reaches the upstream
   `fetch` call. These fail if the handler stops wiring the signal through.
6. The `anthropic-beta: context-1m-2025-08-07` header selects a `-1m` model variant when the
   catalog offers one.
7. `state.is1MContext` selects the same variant without the header.
8. With `state.manualApprove` enabled and the operator declining, the request is rejected with
   HTTP 403 and no upstream call is made.
9. Every global `state` field a test mutates is restored afterwards; the suite leaks nothing
   into other test files.
10. Tests that pin behaviour flagged in `POTENTIAL_FEATURES.md` carry a comment naming the
    entry.
11. `bun run typecheck`, `bun run lint:all`, `bun test`, and `bun run build` all exit 0, with no
    regression to the 204 existing tests.
