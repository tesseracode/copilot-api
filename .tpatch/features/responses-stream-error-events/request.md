# Feature Request: Handle terminal error events from the /responses SSE stream instead of silently truncating. translateResponsesStreamEvent in src/services/copilot/create-responses.ts only switches on success-path events; response.failed, response.incomplete, and response.error are dropped, so Anthropic clients see a stream that just ends with no stop_reason. Emit a final ChatCompletionChunk with finish_reason='error' (or equivalent) carrying the upstream error message, and surface it through translateChunkToAnthropicEvents as a proper Anthropic message_delta with stop_reason and/or an error event. Add unit tests for each terminal event type.

**Slug**: `responses-stream-error-events`
**Created**: 2026-04-29T22:10:07Z

## Description

Handle terminal error events from the /responses SSE stream instead of silently truncating. translateResponsesStreamEvent in src/services/copilot/create-responses.ts only switches on success-path events; response.failed, response.incomplete, and response.error are dropped, so Anthropic clients see a stream that just ends with no stop_reason. Emit a final ChatCompletionChunk with finish_reason='error' (or equivalent) carrying the upstream error message, and surface it through translateChunkToAnthropicEvents as a proper Anthropic message_delta with stop_reason and/or an error event. Add unit tests for each terminal event type.
