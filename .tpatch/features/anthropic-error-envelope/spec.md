# Specification

1. Every error response from `/v1/messages` and `/v1/messages/count_tokens` carries a top-level
   `"type": "error"` and an `error` object with `type` and `message`.
2. An upstream error body that is already Anthropic-shaped is forwarded unchanged, including
   `request_id`. This path is correct today and must not regress.
3. A local `badRequest` (for example an empty `tool_use_id`) is returned as
   `{ "type": "error", "error": { "type": "invalid_request_error", "message": … } }` with status
   400.
4. A local throw (for example a malformed JSON body) is returned in the same envelope with an
   appropriate type and status.
5. When an upstream error body is not JSON, the Anthropic `error.type` is derived from the HTTP
   status: 400 `invalid_request_error`, 401 `authentication_error`, 403 `permission_error`,
   404 `not_found_error`, 413 `request_too_large`, 429 `rate_limit_error`, 5xx `api_error`.
   Any `type` the upstream did supply is preserved in preference to the derived one.
6. The upstream HTTP status is preserved on the response.
7. `/chat/completions` and `/embeddings` keep the OpenAI envelope, unchanged.
8. `badRequest` remains format-neutral, since it is reachable from both contracts.
9. `token` and `usage` are untouched.
10. `bun run typecheck`, `bun run lint:all`, `bun test`, and `bun run build` all exit 0 with no
    regression to the 231 existing tests.
