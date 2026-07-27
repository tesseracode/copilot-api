# Feature Request: Return Anthropic-shaped errors from /v1/messages regardless of where the error originated.

The /v1/messages route currently returns two different error envelopes depending on the error's origin, verified live against the running proxy:

- Upstream rejection: {"type":"error","error":{"type":"invalid_request_error","message":"..."},"request_id":"..."} - correct, because forwardError passes a recognised upstream envelope through unchanged.
- Local validation (badRequest): {"error":{"type":"invalid_request_error","message":"tool_result block is missing tool_use_id"}} - missing the top-level type field.
- Local throw (malformed JSON body): {"error":{"message":"...","type":"error"}} - missing the top-level type field, and type is nested in the wrong place.

So an Anthropic SDK client receives a correctly shaped error when upstream rejects and a malformed one when the proxy itself rejects. It is also inconsistent with the proxy's own streaming behaviour on the same endpoint: translateErrorToAnthropicErrorEvent emits { type: 'error', error: { type, message } }, and the AnthropicErrorEvent interface declares exactly that shape.

Confirmed that the two upstream contracts genuinely differ, so this is differentiation rather than unification. Upstream /v1/messages returns a top-level type field and a request_id; upstream /chat/completions returns {"error":{"message":"...","code":"..."}} with no top-level type. The architecture review had proposed unifying all routes onto one envelope, which would have been wrong: it would have broken the Anthropic contract to match the OpenAI one. The embeddings route's richer type/code/message/param body is the OpenAI error contract, not drift.

badRequest must stay format-neutral: the requireToolCallId badRequest in create-responses.ts is reachable from both /v1/messages and /chat/completions, while the tool_result badRequest in non-stream-translation.ts is reachable only from /v1/messages. Shaping therefore belongs at the route seam, where the contract being served is known.

Add an Anthropic-shaped error forwarder used by messages/route.ts. It must preserve an upstream body that is already Anthropic-shaped, including request_id, since that path is correct today. Otherwise it emits { type: 'error', error: { type, message } }, deriving the Anthropic error type from the HTTP status - 400 invalid_request_error, 401 authentication_error, 403 permission_error, 404 not_found_error, 413 request_too_large, 429 rate_limit_error, 5xx api_error - while preserving a type the upstream already supplied. The status mapping earns its place on the upstream-non-JSON path: a plain-text 401 currently produces no usable type, so a client cannot distinguish an auth failure from a rate limit.

Out of scope: the token and usage routes, which return {"error":"some string"}. They are private, unconsumed by any SDK, and folding them in would repeat the unify-everything instinct that made the original candidate wrong. The /chat/completions and /embeddings routes keep the OpenAI envelope, which is correct for them.

**Slug**: `anthropic-error-envelope`
**Created**: 2026-07-27T17:36:27Z

## Description

Return Anthropic-shaped errors from /v1/messages regardless of where the error originated.

The /v1/messages route currently returns two different error envelopes depending on the error's origin, verified live against the running proxy:

- Upstream rejection: {"type":"error","error":{"type":"invalid_request_error","message":"..."},"request_id":"..."} - correct, because forwardError passes a recognised upstream envelope through unchanged.
- Local validation (badRequest): {"error":{"type":"invalid_request_error","message":"tool_result block is missing tool_use_id"}} - missing the top-level type field.
- Local throw (malformed JSON body): {"error":{"message":"...","type":"error"}} - missing the top-level type field, and type is nested in the wrong place.

So an Anthropic SDK client receives a correctly shaped error when upstream rejects and a malformed one when the proxy itself rejects. It is also inconsistent with the proxy's own streaming behaviour on the same endpoint: translateErrorToAnthropicErrorEvent emits { type: 'error', error: { type, message } }, and the AnthropicErrorEvent interface declares exactly that shape.

Confirmed that the two upstream contracts genuinely differ, so this is differentiation rather than unification. Upstream /v1/messages returns a top-level type field and a request_id; upstream /chat/completions returns {"error":{"message":"...","code":"..."}} with no top-level type. The architecture review had proposed unifying all routes onto one envelope, which would have been wrong: it would have broken the Anthropic contract to match the OpenAI one. The embeddings route's richer type/code/message/param body is the OpenAI error contract, not drift.

badRequest must stay format-neutral: the requireToolCallId badRequest in create-responses.ts is reachable from both /v1/messages and /chat/completions, while the tool_result badRequest in non-stream-translation.ts is reachable only from /v1/messages. Shaping therefore belongs at the route seam, where the contract being served is known.

Add an Anthropic-shaped error forwarder used by messages/route.ts. It must preserve an upstream body that is already Anthropic-shaped, including request_id, since that path is correct today. Otherwise it emits { type: 'error', error: { type, message } }, deriving the Anthropic error type from the HTTP status - 400 invalid_request_error, 401 authentication_error, 403 permission_error, 404 not_found_error, 413 request_too_large, 429 rate_limit_error, 5xx api_error - while preserving a type the upstream already supplied. The status mapping earns its place on the upstream-non-JSON path: a plain-text 401 currently produces no usable type, so a client cannot distinguish an auth failure from a rate limit.

Out of scope: the token and usage routes, which return {"error":"some string"}. They are private, unconsumed by any SDK, and folding them in would repeat the unify-everything instinct that made the original candidate wrong. The /chat/completions and /embeddings routes keep the OpenAI envelope, which is correct for them.
