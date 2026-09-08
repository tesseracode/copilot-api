# Specification

1. `ModelCapabilities.limits` is optional, matching catalog entries that omit it.
2. A chat request naming a model without `limits` returns the upstream result rather than HTTP 500.
3. No `max_tokens` is injected for such a model, because no catalog ceiling exists.
4. A client-supplied `max_tokens` is still forwarded unchanged for such a model.
5. An embeddings request naming a model without `limits` is not rejected by the batch-size check and does not throw.
6. `GET /models` and `GET /v1/models` continue to list such models without error.
7. Models that do declare `limits` keep their current behavior, including catalog-ceiling injection and embedding batch-size validation.
8. `ModelSupports` declares the fields the live catalog sends: `streaming`, `structured_outputs`, `vision`, `adaptive_thinking`, `min_thinking_budget` and `max_thinking_budget`, alongside the existing four.
9. Every read of `limits` in `src/` and `scripts/` is guarded, so `bun run typecheck` passes with the field optional.
10. Regression tests build their catalog fixtures from the verbatim live shape of `gpt-41-copilot` and `text-embedding-3-small-inference`.
11. No model is filtered out of the catalog response, and no request or response shape changes for models that were already working.
