# Specification

1. Unexpected local errors return stable protocol-specific generic messages without internal details.
2. Arbitrary thrown values always produce a non-empty normalized message.
3. Unrecognized/plain upstream bodies are never reflected to clients or logs.
4. Recognized OpenAI/Anthropic envelopes, status, and body request IDs remain unchanged.
5. Safe request-ID, Retry-After, and rate-limit headers are preserved; sensitive headers are not.
6. Non-stream AbortError falls back to redacted HTTP 499.
7. Logs contain metadata only, never raw thrown values or upstream bodies.
8. Mutation tests prove leak redaction, unknown-value normalization, header copying and log sanitization.

Out of scope: streaming errors, which are handled by stream-failure-visibility.
