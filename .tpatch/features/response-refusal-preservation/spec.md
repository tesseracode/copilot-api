# Specification

1. Streaming Responses content_filter remains Chat content_filter and becomes Anthropic refusal.
2. Partial ordinary content is preserved before refusal termination.
3. Refusal delta/done text is preserved exactly once.
4. Non-stream incomplete content_filter becomes Chat content_filter and Anthropic refusal.
5. Non-stream refusal items populate Chat refusal and Anthropic text content.
6. Mixed ordinary/refusal content preserves order in Anthropic blocks.
7. No permission_error is emitted for model refusal.
8. Normal stop, length, tools, usage, errors and terminal-state behavior remain unchanged.
9. Mutation tests prove each refusal mapping is required.
