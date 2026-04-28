# Tracked Features

| Slug | Title | State | Compatibility |
|------|-------|-------|---------------|
| `anthropic-beta-1m-detection` | Detect anthropic-beta: context-1m-2025-08-07 header per-request to activate 1M context window. The Claude Agent SDK sends this header instead of [1m] in the model name. Upgrades model to -1m variant when header is present. | applied | unknown |
| `health-endpoint` | Add a GET /health endpoint that returns JSON with uptime in seconds, model count, and server version from package.json | applied | unknown |
| `hide-internal-models` | Add a --hide-internal CLI flag that filters out models whose ID contains 'internal' or starts with 'accounts/' from the /models response | applied | unknown |
| `internal-suffix-resolution` | Resolve -internal model suffix: when a client requests a -1m variant that doesn't exist but a -1m-internal variant does in the catalog, resolve to the internal variant. Safe no-op when suffix is dropped. | applied | unknown |
| `log-model-display-name` | Log the model display_name alongside the model ID in request log lines, by looking up the model in the cached models list | applied | unknown |
| `model-vendor-filter` | Add a --model-filter vendor flag that filters the /models response to only show models from a specific vendor (e.g. --model-filter anthropic) | applied | unknown |
| `native-payload-sanitization` | Sanitize /v1/messages passthrough payloads: strip whitespace-only stop_sequences entries, and map output_config.effort to thinking budget_tokens since Copilot does not support output_config | applied | unknown |
| `per-generation-thinking` | Per-generation thinking type normalization: older models get enabled+budget, 4.6 models accept both adaptive and enabled, 4.7+ models require adaptive only. Includes output_config.effort forwarding for models that support it. | applied | unknown |
| `reasoning-block-preservation` | Preserve GPT-5.x reasoning blocks through proxy translation: map Responses API 'reasoning' output items to 'reasoning_text' in /chat/completions responses and to 'thinking' blocks in /v1/messages Anthropic responses. Currently reasoning blocks are silently dropped, breaking multi-turn context for reasoning models. | applied | unknown |
| `responses-via-messages` | Route /responses-only models through the /v1/messages handler: when the Anthropic SDK sends GPT-5.x models to /v1/messages, translate Anthropic→OpenAI→Responses and back, with reasoning block handling | requested | unknown |
| `startup-model-count` | Add a model count to the startup banner, e.g. 'Available models: 37 models loaded' | applied | unknown |
| `three-tier-routing` | Three-tier endpoint routing: native /v1/messages passthrough for Claude, /responses API for GPT-5.x, /chat/completions fallback for legacy models | applied | unknown |
| `three-tier-routing-tests` | Unit and e2e test suite for three-tier endpoint routing: endpoint resolution, /v1/messages payload sanitization, Responses API translation, model mapping, plus live API e2e matrix across all three tiers | applied | unknown |
