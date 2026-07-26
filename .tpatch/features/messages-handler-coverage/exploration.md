# Exploration

- `src/routes/messages/handler.ts` — subject under test. Routing decision at `:66`
  (`resolveEndpoint`), tiers dispatched at `:70` (native), `:83` (`/responses`), and `:99+`
  (`/chat/completions` fallback). `detectWants1M` at `:44-47`, the `manualApprove` gate at
  `:55`, and the 1M flag combined at `:60`.
- `tests/claude-chat-passthrough.test.ts` — closest existing pattern: mocks `globalThis.fetch`,
  seeds `state.models`, drives `server.request`, and restores state in `afterEach`. Copy its
  shape.
- `tests/native-responses-route.test.ts` — shows the SSE fixture style (a `Response` with
  `content-type: text/event-stream`) that `fetch-event-stream` will consume.
- `tests/responses-stream-abort-propagation.test.ts` — supplies `lastFetchInit`, the helper
  idiom for reading what reached `fetch`. Its `spyOn(globalThis, "fetch")` approach is what the
  signal assertions should reuse.
- Note for signal assertions: a signal passed through `server.request(path, { signal })` is not
  object-identical to `c.req.raw.signal` downstream, because the `Request` constructor links a
  fresh signal. Assert that a signal reached `fetch` and that aborting the outer controller
  marks it aborted, rather than asserting identity.
- Model catalog entries must set `capabilities.type: "chat"` and a real `tokenizer`, since the
  handler's sibling routes call `getTokenCount`. `supported_endpoints` drives `resolveEndpoint`,
  so each tier needs its own catalog entry; the Claude entry's id must start with `claude-`.
- `src/lib/approval.ts` — `awaitApproval` calls `consola.prompt` and throws an `HTTPError` with
  a 403 response when declined, so the gate is testable by spying on `consola.prompt`.
