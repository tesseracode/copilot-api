# Mutation test evidence

## Pre-implementation red gate

Command:

```sh
bun test tests/non-stream-error-normalization.test.ts
```

Result against unchanged production code: 10 failures, 2 passes. Both recognized-envelope preservation tests passed; redaction, arbitrary-throw normalization, abort fallback and safe-header tests failed.

## Mutations

Each mutation changed one production hunk, ran a focused test, failed at the intended assertion, and restored only that hunk.

1. Local message leak: replaced the generic local message with `error.message`.
   - `--test-name-pattern 'redacts local Error'` failed because the secret appeared in the OpenAI response.
2. Upstream body leak: replaced the safe status fallback with `response.text()`.
   - `--test-name-pattern 'redacts unrecognized upstream bodies'` failed because the provider secret appeared.
3. Metadata loss: returned before the safe-header copy loop.
   - `--test-name-pattern 'preserves safe provider metadata'` failed because request IDs were null.
4. Arbitrary throw regression: returned a message-less envelope for non-Error values.
   - `--test-name-pattern 'normalizes arbitrary thrown values'` failed because message was undefined.
5. Log leak: logged the complete thrown object again.
   - `--test-name-pattern 'redacts local Error'` failed because the rendered log contained the secret and stack.

All exact hunks were restored after the expected failures.
