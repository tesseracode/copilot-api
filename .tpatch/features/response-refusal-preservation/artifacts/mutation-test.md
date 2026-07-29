# Mutation test evidence

## Pre-implementation red gate

```sh
bun test tests/response-refusal-preservation.test.ts
```

Result against unchanged production code: 6 failures, 0 passes. Streaming content_filter became end_turn, refusal events/text were absent, and non-stream incomplete/refusal responses became ordinary empty stop.

## Mutations

Each mutation changed one production hunk, ran a focused test, failed at the intended assertion, and restored only that hunk.

1. Changed `content_filter` mapping back to `end_turn`.
   - Streaming and non-stream Anthropic refusal assertions failed.
2. Removed non-stream `message.refusal` assignment.
   - Non-stream refusal and mixed-content tests failed.
3. Ignored `incomplete_details.reason === content_filter`.
   - Non-stream incomplete test received `stop` instead of `content_filter`.
4. Dropped `response.refusal.delta` output.
   - Streaming refusal text was empty.
5. Re-emitted full refusal text from `response.refusal.done`.
   - Exactly-once test received duplicated `I cannot helpI cannot help`.
6. Removed Anthropic handling of `delta.refusal`.
   - Anthropic refusal content block assertion failed while Chat refusal remained present.

The protocol assertions also require Anthropic `stop_reason: refusal` and explicitly reject error-event/permission-error mapping.
