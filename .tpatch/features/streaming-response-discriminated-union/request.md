# Feature Request: Return a discriminated union from createChatCompletions and createResponses instead of relying on a type guard to tell streaming from non-streaming results.

Deferred; filed while consolidating the SSE pump (see sse-pump-consolidation).

Both services return either an async iterable (streaming) or a plain response object (non-streaming), and callers recover the distinction with a type guard. That guard used to duck-type an own 'choices' property, which worked only because the iterator returned by events() happens not to expose one - the fragility recorded as POTENTIAL_FEATURES.md item 3. sse-pump-consolidation replaced it with a single isNonStreaming in src/lib/streaming.ts that tests Symbol.asyncIterator, which is sound rather than incidental, so the sharp edge is blunted. The structural point stands: callers still have to ask what they were handed instead of being told.

If built, change both services to return a tagged union - for example { kind: 'stream', stream } | { kind: 'object', body } - and have callers switch on the tag. Blast radius measured at the time of filing: four production call sites (src/routes/messages/handler.ts and src/routes/chat-completions/handler.ts, two each) and roughly two test sites, one of which (tests/responses-stream-abort-propagation.test.ts) probes Symbol.asyncIterator directly to decide whether to drain. All four production sites are now covered end to end by tests/messages-handler.test.ts and tests/claude-chat-passthrough.test.ts, so the change is verifiable.

Low priority. The sound predicate removed the actual hazard; this is a clarity and type-safety improvement, not a bug fix.

**Slug**: `streaming-response-discriminated-union`
**Created**: 2026-07-27T05:58:52Z

## Description

Return a discriminated union from createChatCompletions and createResponses instead of relying on a type guard to tell streaming from non-streaming results.

Deferred; filed while consolidating the SSE pump (see sse-pump-consolidation).

Both services return either an async iterable (streaming) or a plain response object (non-streaming), and callers recover the distinction with a type guard. That guard used to duck-type an own 'choices' property, which worked only because the iterator returned by events() happens not to expose one - the fragility recorded as POTENTIAL_FEATURES.md item 3. sse-pump-consolidation replaced it with a single isNonStreaming in src/lib/streaming.ts that tests Symbol.asyncIterator, which is sound rather than incidental, so the sharp edge is blunted. The structural point stands: callers still have to ask what they were handed instead of being told.

If built, change both services to return a tagged union - for example { kind: 'stream', stream } | { kind: 'object', body } - and have callers switch on the tag. Blast radius measured at the time of filing: four production call sites (src/routes/messages/handler.ts and src/routes/chat-completions/handler.ts, two each) and roughly two test sites, one of which (tests/responses-stream-abort-propagation.test.ts) probes Symbol.asyncIterator directly to decide whether to drain. All four production sites are now covered end to end by tests/messages-handler.test.ts and tests/claude-chat-passthrough.test.ts, so the change is verifiable.

Low priority. The sound predicate removed the actual hazard; this is a clarity and type-safety improvement, not a bug fix.
