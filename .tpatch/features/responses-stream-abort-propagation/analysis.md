# Analysis: responses-stream-abort-propagation

## Summary

When a downstream client disconnects mid-stream from `/v1/messages`, `/v1/chat/completions`, or the native passthrough, the proxy keeps consuming the upstream Copilot SSE stream until it finishes naturally. The for-await loops in the route handlers iterate over `events(response)` without observing `c.req.raw.signal`, and the upstream `fetch()` calls in the four service entrypoints (`createChatCompletions`, `createResponses`, `forwardNativeMessages`, and its streaming/non-streaming wrappers) never receive an `AbortSignal`. Result: a client that closes the connection mid-token still costs Copilot quota for the rest of the response.

The fix wires `c.req.raw.signal` end-to-end:

- **Service layer**: each of the four entrypoints accepts an optional `signal?: AbortSignal` (added as an additional positional arg with default `undefined`, matching the existing positional-arg style of these functions). The service forwards it to `fetch(..., { signal })`.
- **Handler layer**: each handler captures `const signal = c.req.raw.signal` once and threads it into the service call. The `for await` loops on event-stream iterators are wrapped in `try/catch` that swallows `AbortError` (as `DOMException` with `name === "AbortError"`) and exits the stream cleanly.

Testing strategy is unit-level: spy on `globalThis.fetch`, call each service entrypoint with a pre-aborted `AbortController.signal`, and assert the `fetch` call received the same signal and the upstream call would not have proceeded. Live curl probing is unreliable here because we cannot directly inspect Copilot's connection state from the client; the unit assertion that the signal threads through is the deterministic check.

## Compatibility

**Status**: compatible

All public service signatures gain an optional trailing parameter. No call site is required to change; existing callers pass through unchanged. Adding `signal` to `fetch` options is universally supported. Wrapping the SSE for-await in a `try/catch` for `AbortError` is silent on success paths.

## Affected Areas

- `src/services/copilot/create-chat-completions.ts` — `createChatCompletions(payload, signal?)`.
- `src/services/copilot/create-responses.ts` — `createResponses(payload, signal?)`.
- `src/services/copilot/forward-native-messages.ts` — `forwardNativeMessages(payload, streamOverride?, is1M?, signal?)`, plus `forwardNativeMessagesNonStreaming(payload, is1M?, signal?)` and `forwardNativeMessagesStreaming(payload, is1M?, signal?)`.
- `src/routes/chat-completions/handler.ts` — capture `c.req.raw.signal`, pass to service, guard the streaming loops.
- `src/routes/messages/handler.ts` — same: three streaming loops to guard (chat-completions branch, /responses branch, native passthrough branch).
- New test file `tests/responses-stream-abort-propagation.test.ts`.

## Acceptance Criteria

1. Each of `createChatCompletions`, `createResponses`, `forwardNativeMessages`, `forwardNativeMessagesNonStreaming`, `forwardNativeMessagesStreaming` accepts an optional `AbortSignal` and forwards it to its underlying `fetch` call.
2. The `signal` flows through to `fetch(url, { ..., signal })`. Verified by unit tests that mock `globalThis.fetch`, pass an `AbortController.signal`, and assert `fetch.mock.calls[0][1].signal === passedSignal`.
3. The streaming for-await loops in both route handlers no longer throw out of `streamSSE` when an `AbortError` (DOMException with `name === "AbortError"`) is observed; the loop exits cleanly.
4. When `c.req.raw.signal.aborted` becomes `true`, the upstream connection is in fact aborted (signal propagated). Asserted via the unit-level fetch spy.
5. Existing tests pass; nothing regresses.
6. `bun test`, `bun run lint`, `bun run typecheck` all pass with no new errors over the pre-existing baseline.

## Implementation Notes

- Use positional optional args, not options bags, to stay consistent with the existing API style (which already uses positional optionals like `is1M?`).
- The for-await `try/catch` should narrow specifically on `AbortError`. Other errors should re-throw so they surface normally.
- Hono's `streamSSE` handler receives a stream object; the underlying `Context` is captured in closure. `c.req.raw.signal` is a standard `Request.signal` and is the right primitive.
- Do not call `signal.addEventListener("abort", ...)` manually — passing the signal to `fetch` is sufficient.

## Unresolved Questions

- Whether to also abort the in-flight HTTPError construction path (e.g. if `fetch` aborts before headers, we currently throw `HTTPError`). Acceptable: the route caller will catch via Hono's normal flow. Out of scope for this feature.
- Whether to log a `consola.debug` line when an abort fires. Useful for debugging quota concerns; safe to include but small detail. Defer to spec.
