# Spec: tool-streaming-id-preservation

## Problem

Streaming tool calls from the upstream `/responses` endpoint broke in two ways. First, repeated argument deltas for the same tool call did not preserve the original OpenAI tool-call index. Second, the live SSE schema carries response metadata under `data.response`, emits tool metadata on `response.output_item.added`, and keys later argument fragments by `output_index`; the proxy ignored those shapes and could emit `stop_reason: "tool_use"` without any `tool_use` content block. The sibling `/chat/completions -> /v1/messages` streaming test should also prove the underlying Anthropic translator preserves block/index mapping for split tool JSON.

## Acceptance Criteria

1. Repeated `response.function_call_arguments.delta` events for the same `call_id` reuse the original OpenAI `tool_calls[index]` instead of allocating a new index.
2. `response.created` and `response.completed` populate the translated chunk metadata from `data.response.id` and `data.response.model`, so Anthropic `message_start` no longer emits an empty model.
3. `response.output_item.added` for `function_call` items emits the initial OpenAI tool-call chunk, and later argument deltas are attached to the same tool via `output_index` even when the delta event does not repeat `call_id` or `name`.
4. `.done` events do not duplicate already streamed JSON fragments, but they still fill any missing suffix if the upstream stream finishes the full arguments there.
5. The Anthropic stream translation receives every argument fragment for that tool call on the same content block, so concatenating the emitted `input_json_delta` payloads yields the full JSON arguments.
6. The existing `/chat/completions -> /v1/messages` streaming tool-call test asserts one `tool_use` block, stable block/index mapping for split argument fragments, the fully reconstructed JSON input, and a final `tool_use` stop reason.
7. The `/responses -> /v1/messages` regression uses the live SSE schema shape (`data.response`, `response.output_item.added`, `output_index`, and `.done` events) and asserts a non-empty model plus the reconstructed tool JSON.
8. `bun run lint`, `bun run build`, and `bun test` pass after the change.

## Out of Scope

- Changing non-streaming `/responses` translation.
- Altering tool schema translation or tool-choice behavior.
- Broad refactors of the Anthropic streaming translator beyond what the stable-index and live-schema fixes require.

## Plan

1. Track `/responses` tool-call state by both `call_id` and `output_index`.
2. Read response metadata from nested `data.response` objects and start tool calls from `response.output_item.added`.
3. Continue and finalize tool arguments from delta and `.done` events without duplicating already streamed JSON.
4. Strengthen the existing `/chat/completions -> /v1/messages` streaming test and keep `/responses` regression coverage aligned with the live schema.
5. Remove temporary debug instrumentation and rerun repo validation plus the controlled repro.
