# Specification

1. Preserve raw `copilot_usage` through non-stream Responses→Chat→Anthropic translations.
2. Derive AI credits from nano-AIU and cache read/write/hit evidence.
3. Leave standard OpenAI and Anthropic usage fields unchanged.
4. Preserve terminal streaming usage where upstream supplies it without inventing content events.
5. Direct Chat behavior remains unchanged.
6. Unit and translation regression tests pass.

Out of scope: persistent ledgers and account quota polling.
