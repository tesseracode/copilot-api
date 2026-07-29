# Exploration

- `src/lib/error.ts`: duplicated OpenAI/Anthropic parsing, raw-body reflection, unsafe error casts and full-value logging.
- `src/routes/chat-completions/route.ts` and `src/routes/messages/route.ts`: protocol boundary callers.
- `tests/anthropic-error-envelope.test.ts`: native envelope/status coverage and unsafe plain-body expectations.
- `tests/messages-tool-result-validation.test.ts`: OpenAI envelope behavior and unsafe local-error expectation.
- New `tests/non-stream-error-normalization.test.ts`: redaction, arbitrary throws, abort fallback, safe headers and recognized envelope preservation.
