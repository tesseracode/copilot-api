# Specification

1. Non-abort translated-stream failures emit one format-correct terminal error event.
2. Anthropic failures emit `event: error` and no `message_stop`.
3. OpenAI Chat failures emit a top-level error SSE record and no fake success terminator.
4. Native Responses preserves preceding bytes, then emits one Responses error event on reader failure.
5. Client disconnects remain silent and do not emit terminal errors.
6. Existing in-band provider error handling does not duplicate events.
7. Focused regression tests must fail when terminal emission is deliberately disabled and pass after restoration.
8. All four quality gates pass.

Out of scope: changing HTTP status after streaming begins or retrying partial generations.
