# Analysis: tool-streaming-id-preservation

This regression is not already present upstream in the current checkout. The first bug was that the `/responses` streaming adapter assigned a fresh tool-call index after the first `response.function_call_arguments.delta` for a given `call_id`, so later argument fragments no longer mapped to the same OpenAI tool call.

The controlled forced-tool repro exposed a second mismatch: the live `/responses` SSE schema does not send enough top-level data on argument delta events for the proxy's current assumptions. `response.created` and `response.completed` carry `id` and `model` under `data.response`, tool metadata arrives on `response.output_item.added`, and later `response.function_call_arguments.delta` events are correlated by `output_index`. Ignoring those shapes caused the proxy to emit `stop_reason: "tool_use"` without ever starting a `tool_use` content block.

Compatibility risk remains low because the fix stays isolated to streaming translation in `src/services/copilot/create-responses.ts` plus test coverage in `tests/anthropic-response.test.ts`. The downstream Anthropic translator in `src/routes/messages/stream-translation.ts` already behaves correctly when it receives a proper start chunk and stable continuation chunks; the failure was entirely in the upstream event-shape adapter.

Primary risk: preserve stable mapping for multiple concurrent tool calls when the live stream uses `output_index` instead of repeating `call_id`/`name`. Secondary risk is duplicate JSON if `.done` events replay the fully assembled arguments after streamed deltas. The safest approach is to track tool-call state by both `call_id` and `output_index`, then only emit the missing suffix from `.done` events.
