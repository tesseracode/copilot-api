# Analysis: Three-tier Endpoint Routing

## Summary

This feature adds intelligent per-model endpoint routing to the copilot-api proxy, selecting the optimal upstream Copilot API endpoint based on each model's `supported_endpoints` metadata. This unlocks native Anthropic passthrough for Claude models (zero-loss), the OpenAI Responses API for GPT-5.x models (previously inaccessible), and preserves the existing `/chat/completions` path for legacy models.

## Upstream Status

**Not present upstream.** The upstream copilot-api project only supports `/chat/completions` for all models. The Copilot API itself exposes three distinct endpoints, but the proxy was not routing to them.

## Compatibility

- **Language/framework**: TypeScript, Hono — fully compatible.
- **Dependencies**: No new dependencies. Uses existing `fetch-event-stream` for SSE.
- **License**: No concerns.
- **Breaking changes**: None. Existing `/chat/completions` behavior is preserved as the fallback tier. The `/v1/messages` endpoint behavior is improved but the API contract is unchanged.

## Risks

- The `/responses` API translation is new and less battle-tested than the `/chat/completions` path. Edge cases in tool calling or streaming may surface.
- The `thinking.type: 'adaptive'` downgrade is a workaround for a temporary Copilot API limitation — will need removal when upstream adds support.
- `minimax-m2.5` is listed in the model catalog but rejected by upstream — this is not a proxy issue.
