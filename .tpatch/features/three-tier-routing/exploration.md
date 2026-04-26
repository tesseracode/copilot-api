# Exploration: Three-tier Endpoint Routing

## Files Modified

| File | Change Type | Description |
|------|-------------|-------------|
| `src/services/copilot/get-models.ts` | Modified | Add `supported_endpoints?: string[]` to `Model` interface |
| `src/routes/models/route.ts` | Modified | Pass through `capabilities`, `supported_endpoints`, `preview`, `model_picker_enabled` |
| `src/lib/endpoint-routing.ts` | **New** | `resolveEndpoint()` — picks `/v1/messages`, `/responses`, or `/chat/completions` per model |
| `src/services/copilot/forward-native-messages.ts` | **New** | Native `/v1/messages` forwarder with `adaptive` thinking downgrade |
| `src/services/copilot/create-responses.ts` | **New** | Full bidirectional `/responses` ↔ Chat Completions translator |
| `src/routes/messages/handler.ts` | Modified | Route Claude models through native passthrough |
| `src/routes/chat-completions/handler.ts` | Modified | Route GPT-5.x models through `/responses` |
| `src/lib/model-mapping.ts` | Modified | Fix `[1m]` handling, add haiku, validate 1M variant exists |

## Key Design Decisions

1. **Routing is data-driven** — uses `supported_endpoints` from the cached `/models` response, not hardcoded model prefixes.
2. **No new dependencies** — reuses `fetch-event-stream` already in the project.
3. **Fallback is always `/chat/completions`** — if a model has no `supported_endpoints`, the existing path is used unchanged.
