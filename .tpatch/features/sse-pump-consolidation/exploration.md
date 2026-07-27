# Exploration

- `src/routes/messages/handler.ts:151-160, 192-203, 267-276` and
  `src/routes/chat-completions/handler.ts:85-96, 140-151` — the five catch blocks.
- `src/routes/messages/handler.ts:207-209` and `src/routes/chat-completions/handler.ts:155-157`
  — the two `isNonStreaming` definitions.
- `src/routes/messages/handler.ts:122-127, 237-242` — the two hand-built state literals.
- `src/routes/messages/anthropic-types.ts:203` — where `AnthropicStreamState` is declared, and
  therefore where its factory belongs. `createResponsesStreamState` in
  `src/services/copilot/create-responses.ts:311` is the precedent.
- `src/lib/` is flat, single-purpose, and kebab-case, so a new `streaming.ts` fits. `src/routes/`
  has no shared module and inventing one would be a new convention.
- Typing note for `isNonStreaming`: a signature of `(response: T | AsyncIterable<unknown>):
  response is T` does not narrow, because `T` absorbs the whole union and the negative branch
  collapses to `never`. `(response: T): response is Exclude<T, AsyncIterable<unknown>>` narrows
  both branches correctly.
- Validation note: route-level abort tests cannot distinguish a swallowed abort from a rethrown
  error — headers are already sent, so both yield HTTP 200 with a partial body and a clean EOF.
  The predicate must be exported and tested directly, or the tests are vacuous for that
  distinction. Confirmed by mutation.
