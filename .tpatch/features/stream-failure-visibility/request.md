# Feature Request: Make a mid-stream upstream failure distinguishable from a completed stream.

Deferred; filed while adding abort coverage (see sse-pump-consolidation).

When a streaming response fails partway through for a reason that is not a client disconnect - the upstream connection dropping, or an error thrown while consuming the SSE body - the handler rethrows, but the response headers were sent long ago. The client therefore observes HTTP 200, a partial body, and a clean EOF. There is no message_stop, no message_delta carrying a stop_reason, and no error event. A truncated stream is indistinguishable from a complete one, and an Anthropic SDK client waits for a terminator that never arrives. Pinned as a characterization test in tests/streaming-abort-handling.test.ts.

This is the sibling of responses-stream-error-events, which handled the errors the upstream signals in band (response.failed, response.incomplete, response.error). Transport-level failures were never covered.

The machinery already exists: src/routes/messages/stream-translation.ts exports translateErrorToAnthropicErrorEvent. What is missing is wiring it to the failure path, and the equivalent for OpenAI-shaped callers.

Design note. After sse-pump-consolidation there is exactly one place where a stream-ending error is classified, streamSSEWithAbort in src/lib/streaming.ts, so this becomes a single-site change rather than five. But that helper is deliberately format-agnostic, while emitting a typed terminal event requires knowing whether the caller speaks Anthropic or OpenAI. The likely shape is an optional onError hook supplied by each caller: the helper keeps owning the decision (is this a client abort?), the caller owns the format. That hook was deliberately not added up front, since nothing varied across it yet.

Behaviour change, so it needs its own spec: clients that currently see a clean EOF would start receiving a terminal error event.

**Slug**: `stream-failure-visibility`
**Created**: 2026-07-27T05:58:52Z

## Description

Make a mid-stream upstream failure distinguishable from a completed stream.

Deferred; filed while adding abort coverage (see sse-pump-consolidation).

When a streaming response fails partway through for a reason that is not a client disconnect - the upstream connection dropping, or an error thrown while consuming the SSE body - the handler rethrows, but the response headers were sent long ago. The client therefore observes HTTP 200, a partial body, and a clean EOF. There is no message_stop, no message_delta carrying a stop_reason, and no error event. A truncated stream is indistinguishable from a complete one, and an Anthropic SDK client waits for a terminator that never arrives. Pinned as a characterization test in tests/streaming-abort-handling.test.ts.

This is the sibling of responses-stream-error-events, which handled the errors the upstream signals in band (response.failed, response.incomplete, response.error). Transport-level failures were never covered.

The machinery already exists: src/routes/messages/stream-translation.ts exports translateErrorToAnthropicErrorEvent. What is missing is wiring it to the failure path, and the equivalent for OpenAI-shaped callers.

Design note. After sse-pump-consolidation there is exactly one place where a stream-ending error is classified, streamSSEWithAbort in src/lib/streaming.ts, so this becomes a single-site change rather than five. But that helper is deliberately format-agnostic, while emitting a typed terminal event requires knowing whether the caller speaks Anthropic or OpenAI. The likely shape is an optional onError hook supplied by each caller: the helper keeps owning the decision (is this a client abort?), the caller owns the format. That hook was deliberately not added up front, since nothing varied across it yet.

Behaviour change, so it needs its own spec: clients that currently see a clean EOF would start receiving a terminal error event.
