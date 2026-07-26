# Analysis

The `/v1/messages` handler is the proxy's primary Anthropic-facing surface and carries every
routing, streaming, and abort decision for three upstream tiers. Nothing drives it. The 204
existing tests all land on pure functions beneath it.

The architecture review proposed a seam under the handler on the grounds that it "can't be
driven" — it takes a Hono `Context`, reads the global `state` singleton, and calls services
imported at module scope. That premise did not survive a probe: `server.request` plus a mocked
`globalThis.fetch` exercises the native and streaming paths today, first attempt, under 12ms
each. The obstacle was never the handler's shape. Nobody had written the tests.

That splits the original candidate cleanly. The coverage carries essentially all the value and
almost none of the risk; the restructure carries the cost and is now justified only by softer
arguments (mocking global `fetch` is ambient — which is really the global-state problem tracked
separately — and orchestration is tangled with SSE plumbing). Coverage is also a prerequisite
for the restructure: nothing should reshape 279 untested lines on the primary product surface.
So the tests come first regardless, and the seam is re-evaluated afterwards.

The highest-value cases are the handler-to-fetch signal assertions.
`tests/responses-stream-abort-propagation.test.ts` holds seven green tests proving
`createChatCompletions`, `createResponses`, and `forwardNativeMessages*` forward an
`AbortSignal` — every one calling the service directly. None crosses a handler. That is
precisely how the reroute defect shipped: `handleNativeReroute` omitted the signal, and a suite
dedicated to signal propagation was blind to it because it tested past the interface instead of
at it. Tiers A, B, and C each need an assertion that the *handler* wires the request signal
through, or the same class of defect stays invisible.

Characterization rather than specification: the goal is to make a later restructure safe, and a
test failing for a pre-existing reason is noise during a refactor. Two behaviours being pinned
are already recorded as questionable in `POTENTIAL_FEATURES.md` (#3 `isNonStreaming` duck-typing,
#5 `content_filter` flattened to `end_turn`); those tests are annotated so they read as
descriptions of today, not as specifications.
