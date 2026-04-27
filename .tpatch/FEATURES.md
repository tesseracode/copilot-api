# Tracked Features

| Slug | Title | State | Compatibility |
|------|-------|-------|---------------|
| `health-endpoint` | Add a GET /health endpoint that returns JSON with uptime in seconds, model count, and server version from package.json | implementing | unknown |
| `hide-internal-models` | Add a --hide-internal CLI flag that filters out models whose ID contains 'internal' or starts with 'accounts/' from the /models response | implementing | unknown |
| `log-model-display-name` | Log the model display_name alongside the model ID in request log lines, by looking up the model in the cached models list | implementing | unknown |
| `model-vendor-filter` | Add a --model-filter vendor flag that filters the /models response to only show models from a specific vendor (e.g. --model-filter anthropic) | implementing | unknown |
| `startup-model-count` | Add a model count to the startup banner, e.g. 'Available models: 37 models loaded' | implementing | unknown |
| `three-tier-routing` | Three-tier endpoint routing: native /v1/messages passthrough for Claude, /responses API for GPT-5.x, /chat/completions fallback for legacy models | applied | unknown |
