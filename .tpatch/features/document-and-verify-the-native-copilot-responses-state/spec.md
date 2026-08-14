# Specification

1. A request that omits `store` reaches upstream with `store` still absent; the proxy never defaults it.
2. `store:false` is forwarded unchanged.
3. `store:true` is forwarded unchanged — never coerced, stripped, or rewritten — and the upstream rejection reaches the client with its status, body, and request-ID headers intact.
4. `previous_response_id` is forwarded unchanged, and the proxy implies no local continuation guarantee.
5. Rules 1-4 hold identically for buffered and streaming (`stream:true`) requests.
6. The proxy stores no response state: no persistence, no response registry, and no fabricated or remapped response identifiers.
7. Responses lifecycle and conversation routes remain absent, continuing to return 404 rather than advertising unsupported state operations.
8. Upstream response storage is documented as distinct from proxy/gateway usage accounting; `copilot_usage` reporting is unaffected by `store`.
9. `README.md` documents the stateless Responses contract: clients must send `store:false` and replay complete history.
10. `README.md` records certified client guidance — VS Code 1.133.0 with Copilot Chat 0.61.0 requires `zeroDataRetentionEnabled: true` so the client sends `store:false`; Hermes Agent must send `store:false`, omit lifecycle continuation fields, and replay full history.
11. No speculative code change ships: tool-call timeout behavior is unchanged because that failure was proven gateway-owned and fixed there.
12. Existing native Responses behavior — model validation, stream type validation, SSE passthrough, and header forwarding — is unchanged.
