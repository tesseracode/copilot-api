# Mutation test evidence

## Pre-implementation regression

Command:

```sh
bun test tests/streaming-abort-handling.test.ts --test-name-pattern 'terminal Anthropic error'
```

Result: failed as expected. The client body contained partial `message_start` data but no `event: error`; `body.match(/event: error/g)` was `null`.

## Translated stream callback mutation

Mutation: replaced `await onError(stream, error)` in `src/lib/streaming.ts` with a no-op.

Command:

```sh
bun test tests/streaming-abort-handling.test.ts --test-name-pattern 'terminal Anthropic error'
```

Result: failed as expected at the terminal error assertion. Restored only the exact callback hunk; the same command then passed (1 pass, 5 filtered).

## Native Responses wrapper mutation

Mutation: removed the native Responses error-event enqueue and closed the stream directly.

Command:

```sh
bun test tests/stream-failure-visibility.test.ts --test-name-pattern 'terminal Responses error'
```

Result: failed as expected because no `event: error` was present. Restored only the exact enqueue hunk; the same command then passed (1 pass, 1 filtered).

These mutations prove the regressions fail when either terminal error mechanism is removed. Client-abort silence remains covered separately.

## Independent review follow-up

Security, external-client compatibility, and code-quality reviewers identified broad substring error detection, pre-aborted/pending-read cancellation, duplicate in-band errors, exception logging, missing OpenAI route coverage, and weakened helper coverage. The implementation was tightened with parsed SSE-frame detection, active reader cancellation, exactly-once terminal state, sanitized logs, exact OpenAI envelope assertions, successful byte-fidelity coverage, and restored predicate/type-guard tests. Final full suite: 241 passing.
