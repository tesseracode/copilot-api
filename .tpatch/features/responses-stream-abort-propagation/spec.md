# Specification: responses-stream-abort-propagation

## Acceptance Criteria

1. **Service signatures** accept an optional `AbortSignal` as a trailing positional parameter:
   - `createChatCompletions(payload: ChatCompletionsPayload, signal?: AbortSignal)`
   - `createResponses(payload: ChatCompletionsPayload, signal?: AbortSignal)`
   - `forwardNativeMessages(payload, streamOverride?: boolean, is1M?: boolean, signal?: AbortSignal): Promise<Response>`
   - `forwardNativeMessagesNonStreaming(payload, is1M?: boolean, signal?: AbortSignal)`
   - `forwardNativeMessagesStreaming(payload, is1M?: boolean, signal?: AbortSignal)`

2. **Each service forwards `signal` to `fetch`.** `fetch(url, { ..., signal })`. When `signal` is `undefined`, the option is still set (`signal: undefined`); fetch tolerates this.

3. **Handlers capture `c.req.raw.signal` once** at the top of the request and pass it to each service call:
   - `src/routes/chat-completions/handler.ts` at lines 65 and 85.
   - `src/routes/messages/handler.ts` at lines 87 (createChatCompletions), 141 and 146 (forwardNativeMessages*), and 167 (createResponses).

4. **Streaming loops swallow `AbortError`.** Each `for await (... of stream)` inside `streamSSE` is wrapped:
   ```ts
   try {
     for await (...) { ... }
   } catch (err) {
     if (err instanceof Error && err.name === "AbortError") {
       consola.debug("Stream aborted by client")
       return
     }
     throw err
   }
   ```
   `DOMException` extends `Error` in Node/Bun, so `err.name === "AbortError"` is a sufficient discriminant.

5. **Tests** under `tests/responses-stream-abort-propagation.test.ts`:
   - For each of the five service entrypoints: spy on `globalThis.fetch` (returning a minimal mocked `Response`), call the service with an `AbortController.signal`, and assert the spy received the same `signal` reference in its second-arg `init.signal`.
   - For `createChatCompletions` and `createResponses` non-streaming paths, the mocked Response has a JSON body; for streaming paths, the mocked Response has a `body` ReadableStream that yields zero bytes (so `events()` immediately ends).
   - Confirm a pre-aborted signal results in the service's `fetch` call receiving an aborted signal (`signal.aborted === true`).
   - Restore `globalThis.fetch` after each test.

6. **No behaviour regression** in existing 103 tests. Lint and typecheck pass with no new errors.

## Out of Scope

- Live HTTP-level integration test verifying upstream connection close. The unit-level signal-forwarding assertion is the deterministic check; integration would require either mocking Copilot or inspecting socket state, both beyond this feature.
- Abort propagation through approval prompts (`awaitApproval`). The approval flow is synchronous-blocking by design and runs before the upstream call.
- Adding `signal` to `getTokenCount`, `checkRateLimit`, or other helpers — they are not blocking on Copilot and don't need cancellation.

## Implementation Plan

1. **`create-chat-completions.ts`**: change the `createChatCompletions` arrow signature to accept `signal?: AbortSignal` as a second arg; pass to `fetch(... , { ..., signal })`.

2. **`create-responses.ts`**: same change to `createResponses` (currently `async function`).

3. **`forward-native-messages.ts`**:
   - `forwardNativeMessages` gains a 4th positional optional arg `signal?: AbortSignal`; pass to `fetch(..., { ..., signal })`.
   - `forwardNativeMessagesNonStreaming` and `forwardNativeMessagesStreaming` gain a 3rd positional optional arg `signal?: AbortSignal`; pass to `forwardNativeMessages(..., signal)`.

4. **`src/routes/chat-completions/handler.ts`**:
   - In `handleCompletion`, after parsing payload, do `const signal = c.req.raw.signal`.
   - Pass `signal` to `createChatCompletions(payload, signal)` and to `handleResponsesEndpoint` (which itself passes to `createResponses(payload, signal)`).
   - Wrap the `for await` loop bodies in `try/catch` that swallows `AbortError`. Two loops (chat-completions stream, /responses stream).
   - `handleResponsesEndpoint` takes `(c, payload, signal)`.

5. **`src/routes/messages/handler.ts`**:
   - In `handleCompletion`, after parsing payload, `const signal = c.req.raw.signal`.
   - Three sites: `createChatCompletions(openAIPayload, signal)`, `handleNativePassthrough(c, payload, wants1M, signal)`, `handleResponsesViaAnthropic(c, openAIPayload, signal)`.
   - `handleNativePassthrough` and `handleResponsesViaAnthropic` take an additional `signal?: AbortSignal` parameter and pass it down.
   - Wrap each of the three streaming for-await loops in the same `try/catch`.

6. **Tests**: write `tests/responses-stream-abort-propagation.test.ts`. Use `spyOn(globalThis, "fetch")` returning a synthetic Response with empty body. Verify each service forwards `signal`.

7. Run `bun test`, `bun run lint`, `bun run typecheck`. Commit.

## Risks

- **Hono's `streamSSE` may itself surface or suppress AbortError.** If it already swallows abort cleanly, our `try/catch` is harmless. If it doesn't, our wrap is the correct fix. Either way, defensive wrap is correct.
- **Pre-existing typecheck errors** (documented during feature 1) remain. Verified before commit.
- **Test side-effects on the global `fetch`**: each test must restore the spy in `afterEach` / `finally` to avoid leaking state across tests.
- **`copilotToken` guard**: `createChatCompletions` checks for `state.copilotToken` and throws synchronously before `fetch`. The test must arrange `state.copilotToken` (set on the imported `state` singleton) before invocation, or stub the check.
