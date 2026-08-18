# Exploration

- `src/services/copilot/create-responses.ts:204` (`translateRequestToResponses`): the strict allowlist that omits `temperature`/`top_p`; the single funnel for every Responses translation and therefore the right place to warn.
- `src/services/copilot/create-responses.ts:889`: the only call site, inside `createResponses`, so a warning here fires exactly once per request for both streaming and non-streaming.
- `src/services/copilot/create-chat-completions.ts:157-158`: `ChatCompletionsPayload` declares both parameters, and the service forwards the payload with `JSON.stringify`, which is why Chat-routed models honour them and creates the asymmetry to document.
- `src/lib/endpoint-routing.ts` (`resolveEndpoint`): decides which models take the Responses path, and therefore which requests are affected.
- `src/routes/responses/route.ts`: native passthrough, unaffected — a client calling it directly still sends whatever it likes and receives upstream's own rejection.
- `src/routes/messages/non-stream-translation.ts:506-509`: the Anthropic path sets `temperature`/`top_p` on its Chat payload, so it inherits the same routing-dependent behavior.
- `tests/responses-effort-forwarding.test.ts`: existing pattern for asserting the exact translated Responses payload from a pure call.
- Measured upstream behavior: `temperature: 0.2` rejected with `400 Unsupported parameter` on `gpt-5.3-codex`, `gpt-5.4-mini`, `gpt-5.4`, `gpt-5.5` and `gpt-5.6-luna`; `temperature: 1` accepted on all; `top_p: 0.5` accepted by `gpt-5.3-codex` and rejected by the rest.
- Catalog signal: a full-text scan of the live `/models` response contains no occurrence of `temperature` or `top_p`, so per-model forwarding could only be a hardcoded list.
- Out of scope: forwarding either parameter, per-model allowlists, changing the native route, and any response-shape or header change.
