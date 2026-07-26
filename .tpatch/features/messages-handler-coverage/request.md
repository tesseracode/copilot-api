# Feature Request: Add end-to-end characterization coverage for the /v1/messages route handler.

src/routes/messages/handler.ts is 279 lines that own every routing, streaming and abort decision on the proxy's primary Anthropic-facing surface, and no test drives it. All existing tests land on pure functions beneath it. An architecture review confirmed /v1/messages and /chat/completions were the only routes never exercised end to end, while /health, /v1/pricing, /v1/embeddings and /responses all were.

The review initially proposed restructuring the handler behind a testable seam. That premise was disproved: a probe showed server.request plus a mocked global fetch drives every path of the handler today - native passthrough and streaming both passed first attempt in under 12ms. The gap was never a missing seam, only missing tests. The restructure is therefore deferred and will be re-evaluated once behaviour is pinned; this feature delivers the coverage that was the actual value.

The most important cases are the handler-to-fetch signal wiring for all three tiers. tests/responses-stream-abort-propagation.test.ts already has seven passing tests asserting that createChatCompletions, createResponses and forwardNativeMessages* forward an AbortSignal - but every one calls the service directly, so none crosses a handler. That blind spot is exactly how the reroute defect shipped: handleNativeReroute never passed the signal, and a suite dedicated to signal propagation could not see it because it tested past the interface rather than at it.

Twelve characterization cases in tests/messages-handler.test.ts, driven through server.request with mocked fetch:
- Tier A, native /v1/messages for Claude: non-streaming, streaming, and signal reaching the upstream fetch.
- Tier B, /responses for GPT-5.x arriving on /v1/messages: non-streaming, streaming, and signal reaching the upstream fetch.
- Tier C, /chat/completions fallback for legacy models: non-streaming, streaming, and signal reaching the upstream fetch.
- Cross-cutting: the anthropic-beta context-1m-2025-08-07 header selecting a 1M model variant, the state.is1MContext global flag doing the same, and the manualApprove gate rejecting a request with 403 when the operator declines.

Characterization-first: these tests pin what the handler does today so a later restructure is safe, rather than asserting intended behaviour. Where a test pins behaviour already flagged as questionable in .tpatch/POTENTIAL_FEATURES.md - item 3, the isNonStreaming duck-typed discriminator, and item 5, content_filter being flattened to end_turn - the test carries a comment pointing at the entry so it is not mistaken for a specification.

Tests must save and restore every global state field they touch. POTENTIAL_FEATURES-adjacent review found nine existing test files mutating the state singleton with several never restoring it, so this suite should not add to that.

Out of scope: restructuring the handler, and backfilling equivalent signal-wiring assertions on the /chat/completions handler.

**Slug**: `messages-handler-coverage`
**Created**: 2026-07-26T00:08:33Z

## Description

Add end-to-end characterization coverage for the /v1/messages route handler.

src/routes/messages/handler.ts is 279 lines that own every routing, streaming and abort decision on the proxy's primary Anthropic-facing surface, and no test drives it. All existing tests land on pure functions beneath it. An architecture review confirmed /v1/messages and /chat/completions were the only routes never exercised end to end, while /health, /v1/pricing, /v1/embeddings and /responses all were.

The review initially proposed restructuring the handler behind a testable seam. That premise was disproved: a probe showed server.request plus a mocked global fetch drives every path of the handler today - native passthrough and streaming both passed first attempt in under 12ms. The gap was never a missing seam, only missing tests. The restructure is therefore deferred and will be re-evaluated once behaviour is pinned; this feature delivers the coverage that was the actual value.

The most important cases are the handler-to-fetch signal wiring for all three tiers. tests/responses-stream-abort-propagation.test.ts already has seven passing tests asserting that createChatCompletions, createResponses and forwardNativeMessages* forward an AbortSignal - but every one calls the service directly, so none crosses a handler. That blind spot is exactly how the reroute defect shipped: handleNativeReroute never passed the signal, and a suite dedicated to signal propagation could not see it because it tested past the interface rather than at it.

Twelve characterization cases in tests/messages-handler.test.ts, driven through server.request with mocked fetch:
- Tier A, native /v1/messages for Claude: non-streaming, streaming, and signal reaching the upstream fetch.
- Tier B, /responses for GPT-5.x arriving on /v1/messages: non-streaming, streaming, and signal reaching the upstream fetch.
- Tier C, /chat/completions fallback for legacy models: non-streaming, streaming, and signal reaching the upstream fetch.
- Cross-cutting: the anthropic-beta context-1m-2025-08-07 header selecting a 1M model variant, the state.is1MContext global flag doing the same, and the manualApprove gate rejecting a request with 403 when the operator declines.

Characterization-first: these tests pin what the handler does today so a later restructure is safe, rather than asserting intended behaviour. Where a test pins behaviour already flagged as questionable in .tpatch/POTENTIAL_FEATURES.md - item 3, the isNonStreaming duck-typed discriminator, and item 5, content_filter being flattened to end_turn - the test carries a comment pointing at the entry so it is not mistaken for a specification.

Tests must save and restore every global state field they touch. POTENTIAL_FEATURES-adjacent review found nine existing test files mutating the state singleton with several never restoring it, so this suite should not add to that.

Out of scope: restructuring the handler, and backfilling equivalent signal-wiring assertions on the /chat/completions handler.
