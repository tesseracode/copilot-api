# Mutation test evidence

## Pre-implementation red gate

Command:

```sh
bun test tests/streaming-response-discriminated-union.test.ts
```

Result against unchanged services: 4 failures, 0 passes. Neither object nor stream paths returned an explicit `kind` wrapper.

## Mutations

1. Chat stream branch returned `kind: object` with the iterator as body.
   - `--test-name-pattern 'Chat streams'` failed: expected `stream`, received `object`.
2. Responses object branch returned `kind: stream` with the translated body as stream.
   - `--test-name-pattern 'Responses non-stream'` failed with the wrong shape.
3. Chat handler deliberately dispatched `kind: stream` through the object branch.
   - `bun run typecheck` failed on missing `body`/`stream` properties in the narrowed variants.
4. Added a temporary third `{kind: pending}` variant to `ServiceResult`.
   - `bun run typecheck` failed at all four handlers because `pending` lacked `stream`, proving callers are exhaustive over the current union.
5. A stream fixture exposing both `choices: []` and `Symbol.asyncIterator` remained a stream because dispatch uses only `kind`.

Each production mutation was restored by replacing only the exact changed hunk. The restored direct contract tests and typecheck pass.
