# Exploration

- `src/routes/responses/route.ts`: validates only `model` and the type of `stream`, then forwards `JSON.stringify(payload)`, so `store` and `previous_response_id` already survive untouched — the behavior to pin, not to change.
- `src/lib/copilot-fetch.ts`: upstream dispatch and token refresh; carries the request body verbatim and is where a coercion would otherwise be tempting.
- `src/lib/responses-stream-wrapper.ts`: applied only when `content-type` is `text/event-stream`, so streaming cases need their own forwarding assertions.
- `tests/native-responses-route.test.ts`: already proves arbitrary field preservation, raw SSE passthrough, and upstream error/status/request-ID forwarding — extend with the omitted/`false`/`true` `store` matrix and `previous_response_id`, buffered and streaming.
- `tests/operational-hardening.test.ts`: already asserts `/v1/responses/<id>`, `/responses/<id>`, and `/v1/conversations` return 404, satisfying the "do not advertise unsupported state operations" criterion.
- `src/lib/copilot-usage.ts`: proxy accounting is independent of upstream `store`; the docs must keep the two separate.
- `README.md` §API Endpoints: home for the stateless contract statement and certified client guidance.
- Gateway evidence: `tesseragateway@cf8b650` — `docs/contracts/inference-compatibility.md` (matrix v4) for ownership boundaries, `docs/evidence/vscode-responses-compatibility/2026-08-13.md` for the certified VS Code/Copilot Chat versions and the gateway-owned timeout fix.
- Out of scope: proxy-side persistence, `store` coercion, lifecycle endpoint emulation, gateway-owned validation and timeout policy, and any tool-call change.
