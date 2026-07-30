# Provider role matrix

Live bounded probes used the private proxy on port 4246 with minimal output and supported low-cost effort. Only statuses and short marker outputs were retained.

| Model | Route | System | Developer | Mixed | Notes |
|---|---|---:|---:|---:|---|
| gpt-5.6-sol | Responses via Chat | 200 / ROLE_OK | 200 / ROLE_OK | 200 / ROLE_OK | Both roles accepted and preserved. Earlier conflict probe showed later high-authority message wins. |
| gpt-5-mini | Responses via Chat | 200 | 200 | 200 | Accepted all roles; short probe returned no text. |
| mai-code-1-flash-picker | Responses via Chat | 200 | 200 | 200 | Microsoft MAI accepted all preserved Responses roles; short probe returned no text. |
| gemini-3.5-flash | Chat passthrough | 200 | 200 | 200 | Bypasses Responses translator. System produced marker; developer/mixed produced empty short completion. Valid assistant tool-call/result flow returned 200. |
| gpt-4.1 | Chat passthrough | 200 / ROLE_OK | 200 / ROLE_OK | 200 / ROLE_OK | Bypasses Responses translator; valid assistant tool-call/result flow returned 200. |
| claude-sonnet-4.6 | Chat→Messages | 200 / ROLE_OK | 200, developer instruction ignored | 200 / ROLE_OK | Anthropic has top-level system and no developer message role. Separate measured gap filed as `claude-developer-instruction-preservation`. |

## Contract conclusions

- Responses-routed non-OpenAI MAI sees the same Chat→Responses translator and accepts preserved system/developer roles.
- Gemini and legacy Chat models do not see this translator; role support is their upstream OpenAI-compatible Chat contract.
- No probed provider exposed additional public message roles beyond system/developer/user/assistant plus tool-call/result structures appropriate to its endpoint.
- Claude's developer-role handling is a distinct Chat→Anthropic conversion problem and is not changed by this feature.
