# Exploration

- `src/services/copilot/get-models.ts`: `ModelCapabilities.limits` declared required and `ModelSupports` declaring only four of the ten fields the catalog sends; the root defect.
- `src/routes/chat-completions/handler.ts:58`: `selectedModel?.capabilities.limits.max_output_tokens` — the optional chain covers `selectedModel` only, so this is the HTTP 500.
- `src/routes/embeddings/route.ts:51`: `model.capabilities.limits.max_inputs`, the same unguarded read on the embeddings path.
- `src/lib/endpoint-routing.ts`: models with no `supported_endpoints` fall through to `/chat/completions`, which is what makes both entries reachable.
- `scripts/lib/context-boundary.ts`, `scripts/context-boundary-validation.ts`, `scripts/lib/copilot-test-lib.ts`: the six tooling reads the type change surfaces; `scripts/` is eslint-ignored but still typechecked.
- `tests/catalog-shape-resilience.test.ts`: new coverage driving both routes plus the model list with limit-less fixtures.
- `tests/chat-token-limit-injection.test.ts`: existing contract for when the catalog ceiling is injected, which must keep passing.
- Live evidence (2026-09-07, 42 models): `gpt-41-copilot` and `text-embedding-3-small-inference` carry no `limits` and no `supported_endpoints`; a route test with the former returned HTTP 500 before the fix.
- Out of scope: filtering these models from the catalog response, consuming the newly declared thinking-budget fields, and any change to models that already declare `limits`.
