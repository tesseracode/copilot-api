# Spec: Three-tier Endpoint Routing

## Problem Statement

The copilot-api proxy routes all model requests through `/chat/completions`, which means:
1. Claude models lose native features (prompt caching, thinking blocks, extended output) due to Anthropic→OpenAI→Anthropic translation.
2. GPT-5.x models that only support `/responses` (gpt-5.5, gpt-5.4-mini, gpt-5.2-codex, gpt-5.3-codex) are completely inaccessible.
3. Model metadata (capabilities, supported_endpoints) is stripped from the `/models` response.

## Acceptance Criteria

1. `curl localhost:4141/models | jq '.data[0].supported_endpoints'` returns the upstream endpoints array.
2. Claude model requests via `/v1/messages` are forwarded natively to upstream `/v1/messages` — no OpenAI translation.
3. `thinking: { type: 'adaptive' }` is downgraded to `{ type: 'enabled', budget_tokens: max(1024, max_tokens-1) }` before forwarding.
4. GPT-5.x models route through `/responses` with full request/response translation to/from Chat Completions format.
5. Legacy models (GPT-4.x, Gemini, etc.) continue using `/chat/completions` unchanged.
6. Model ID mapping handles `[1m]` suffix and only appends `-1m` when the variant exists in the catalog.

## Out of Scope

- WebSocket `/responses` support (`ws:/responses`).
- Streaming for native `/v1/messages` passthrough validation (works but not explicitly acceptance-tested).
- Fixing upstream issues (e.g. `minimax-m2.5` rejected by GitHub API).

## Plan

1. Add `supported_endpoints` to `Model` interface (`src/services/copilot/get-models.ts`).
2. Pass through metadata in `/models` route (`src/routes/models/route.ts`).
3. Create endpoint resolver (`src/lib/endpoint-routing.ts`).
4. Create native messages forwarder (`src/services/copilot/forward-native-messages.ts`).
5. Create `/responses` API translator (`src/services/copilot/create-responses.ts`).
6. Update messages handler for native passthrough (`src/routes/messages/handler.ts`).
7. Update chat-completions handler for `/responses` routing (`src/routes/chat-completions/handler.ts`).
8. Fix model mapping for `[1m]` suffix and haiku (`src/lib/model-mapping.ts`).
