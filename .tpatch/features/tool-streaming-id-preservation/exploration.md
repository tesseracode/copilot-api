# Exploration: tool-streaming-id-preservation

## Relevant Files

- `src/services/copilot/create-responses.ts`
  - `ResponsesStreamState` needs enough state to map live `/responses` tool streams by both `call_id` and `output_index`.
  - `translateResponsesStreamEvent()` must handle nested `data.response` metadata, `response.output_item.added`, streamed argument deltas, and `.done` events from the live schema without duplicating JSON.
- `src/routes/messages/stream-translation.ts`
  - `translateChunkToAnthropicEvents()` keys tool-call continuation fragments by OpenAI tool-call index. If the index changes, later fragments are dropped.
- `tests/anthropic-response.test.ts`
  - Existing streaming tests start at OpenAI chat-completion chunks, but the `/chat/completions -> /v1/messages` tool-call case currently only validates event shape.
  - The `/responses` regression should model the live SSE shape rather than a simplified synthetic shape so the exact upstream contract stays covered.
- `src/routes/messages/handler.ts`
  - Temporary verbose-only debug logs were added for the controlled repro and should be removed once the new translation path is validated.

## Smallest Changeset

1. Extend `src/services/copilot/create-responses.ts` to track tool-call state by `call_id` and `output_index`, populate metadata from `data.response`, and translate `response.output_item.added`/`.done` plus argument delta events.
2. Keep the `/responses` regression test in `tests/anthropic-response.test.ts`, but update it to match the live SSE schema and assert the translated model plus reconstructed JSON.
3. Keep the strengthened existing chat-completions streaming tool-call test in that same file.
4. Remove the temporary debug logs from `src/routes/messages/handler.ts`.

## Validation

- `bun run lint`
- `bun run build`
- `bun test`
- Replay the forced-tool `/v1/messages` repro against the built CLI and confirm the stream includes `content_block_start` with `tool_use`, `input_json_delta` fragments, `content_block_stop`, and final `message_delta` / `message_stop`.
