# Specification

1. Expose POST `/responses` and `/v1/responses` aliases.
2. Accept only models advertising `/responses`.
3. Preserve arbitrary native request fields and raw non-stream response JSON.
4. Preserve raw SSE event ordering and client cancellation.
5. Preserve usage, copilot_usage, tools, reasoning, media, IDs, errors, and safe headers.
6. Use shared 401 refresh-and-retry behavior.
7. Do not advertise retrieve/cancel/background/conversation lifecycle support.
8. Route and passthrough tests pass.
