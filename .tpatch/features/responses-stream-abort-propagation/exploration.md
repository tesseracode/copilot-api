# Exploration: responses-stream-abort-propagation

## Files to change

1. `src/services/copilot/create-chat-completions.ts` — extend signature, plumb signal.
2. `src/services/copilot/create-responses.ts` — extend signature, plumb signal.
3. `src/services/copilot/forward-native-messages.ts` — extend three function signatures.
4. `src/routes/chat-completions/handler.ts` — capture signal, thread to two service calls, wrap two streaming loops.
5. `src/routes/messages/handler.ts` — capture signal, thread to three service calls, wrap three streaming loops.

## Files to add

- `tests/responses-stream-abort-propagation.test.ts`.

## Call-site inventory

- `chat-completions/handler.ts:65` — `createChatCompletions(payload)` → `createChatCompletions(payload, signal)`.
- `chat-completions/handler.ts:74` — `for await (const chunk of response)` (streamSSE branch). Wrap.
- `chat-completions/handler.ts:85` — `createResponses(payload)` → `createResponses(payload, signal)`.
- `chat-completions/handler.ts:96` — `for await (const rawEvent of response)`. Wrap.
- `messages/handler.ts:87` — `createChatCompletions(openAIPayload)` → `createChatCompletions(openAIPayload, signal)`.
- `messages/handler.ts:111` — `for await (const rawEvent of response)`. Wrap.
- `messages/handler.ts:141` — `forwardNativeMessagesNonStreaming(payload, is1M)` → add `signal`.
- `messages/handler.ts:146` — `for await (const event of forwardNativeMessagesStreaming(payload, is1M))` → pass `signal` and wrap loop.
- `messages/handler.ts:167` — `createResponses(openAIPayload)` → add `signal`.
- `messages/handler.ts:183` — `for await (const rawEvent of response)`. Wrap.

## Existing tests to preserve

- `tests/anthropic-response.test.ts`, `tests/anthropic-request.test.ts`, `tests/create-chat-completions.test.ts`, `tests/responses-stream-stable-ids.test.ts`, `tests/responses-stream-arg-divergence-guard.test.ts`, `tests/responses-stream-error-events.test.ts`, `src/lib/*.test.ts`, `src/services/copilot/forward-native-messages.test.ts`. None of these should break — the service signatures are widened only by an optional trailing arg.

## Test design

- Use `spyOn(globalThis, "fetch")` to capture `init.signal`.
- Provide a minimal Response. For non-streaming, return a `Response(JSON.stringify({...}), { headers: {"content-type":"application/json"} })`. For streaming, return a Response with an empty `ReadableStream` so `events()` immediately drains.
- Guard `state.copilotToken`: assign a placeholder token before each test, restore after.
- Restore `globalThis.fetch` in a `finally`.

Tests:

1. `createChatCompletions` non-streaming path forwards signal.
2. `createResponses` non-streaming path forwards signal.
3. `createResponses` streaming path forwards signal.
4. `forwardNativeMessages` forwards signal.
5. `forwardNativeMessagesStreaming` forwards signal (verifies wrapper passes signal to inner `forwardNativeMessages`).
6. Pre-aborted signal: `controller.abort()` before service call, then call service, expect either the upstream fetch was called with an aborted signal OR the service throws. Either outcome is acceptable as long as the signal forwarded is `aborted === true`.

Lower-priority cases (skip if time-pressed):
- `forwardNativeMessagesNonStreaming` is a thin wrapper around `forwardNativeMessages` and is covered by case (4)/(5) transitively.

## Insertion points (recipe-friendly anchors)

1. **`createChatCompletions`** — anchor on:
   ```
   export const createChatCompletions = async (
     payload: ChatCompletionsPayload,
   ) => {
   ```
   And on:
   ```
     const response = await fetch(`${copilotBaseUrl(state)}/chat/completions`, {
       method: "POST",
       headers,
       body: JSON.stringify(payload),
     })
   ```

2. **`createResponses`** — anchor on:
   ```
   export async function createResponses(payload: ChatCompletionsPayload) {
   ```
   And on:
   ```
     const response = await fetch(url, {
       method: "POST",
       headers: copilotHeaders(state),
       body: JSON.stringify(responsesPayload),
     })
   ```

3. **`forwardNativeMessages`** — anchor on the full signature block:
   ```
   export async function forwardNativeMessages(
     payload: AnthropicMessagesPayload,
     streamOverride?: boolean,
     is1M?: boolean,
   ): Promise<Response> {
   ```
   And on the fetch call:
   ```
     const response = await fetch(url, {
       method: "POST",
       headers: copilotHeaders(state),
       body: JSON.stringify(body),
     })
   ```

4. **`forwardNativeMessagesNonStreaming` / `Streaming`** — anchor on each function signature.

5. **Handlers** — anchor on each `for await` block plus the service call lines.

## Smallest changeset

- 2 ops in create-chat-completions.ts (signature + fetch).
- 2 ops in create-responses.ts (signature + fetch).
- 4 ops in forward-native-messages.ts (3 signatures + 1 fetch).
- 4 ops in chat-completions/handler.ts (capture signal, 2 calls + signature on inner func, 2 try/catch wraps).
- 4 ops in messages/handler.ts (capture signal, 3 calls + 2 inner-func signatures, 3 try/catch wraps).

To keep the recipe tractable, several of these will be combined into single `replace-in-file` ops that replace whole functions or larger blocks where the surrounding context is unique. Total target: ≤16 ops.

## Risk: fetch signal init type

Modern TypeScript types `RequestInit.signal` as `AbortSignal | null`. Passing `signal: undefined` works at runtime but may type-error. Mitigation: use spread `...(signal ? { signal } : {})` OR cast. Plan: spread.
