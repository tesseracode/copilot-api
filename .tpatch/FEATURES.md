# Tracked Features

| Slug | Title | State | Compatibility |
|------|-------|-------|---------------|
| `health-endpoint` | Add a GET /health endpoint that returns JSON with uptime in seconds, model count, and server version from package.json | applied | unknown |
| `hide-internal-models` | Add a --hide-internal CLI flag that filters out models whose ID contains 'internal' or starts with 'accounts/' from the /models response | applied | unknown |
| `log-model-display-name` | Log the model display_name alongside the model ID in request log lines, by looking up the model in the cached models list | applied | unknown |
| `model-vendor-filter` | Add a --model-filter vendor flag that filters the /models response to only show models from a specific vendor (e.g. --model-filter anthropic) | applied | unknown |
| `native-payload-sanitization` | Sanitize /v1/messages passthrough payloads: strip whitespace-only stop_sequences entries, and map output_config.effort to thinking budget_tokens since Copilot does not support output_config | defined | unknown |
| `startup-model-count` | Add a model count to the startup banner, e.g. 'Available models: 37 models loaded' | applied | unknown |
| `three-tier-routing` | Three-tier endpoint routing: native /v1/messages passthrough for Claude, /responses API for GPT-5.x, /chat/completions fallback for legacy models | applied | unknown |
| `three-tier-routing-tests` | Unit and e2e test suite for three-tier endpoint routing: endpoint resolution, /v1/messages payload sanitization, Responses API translation, model mapping, plus live API e2e matrix across all three tiers | defined | unknown |
