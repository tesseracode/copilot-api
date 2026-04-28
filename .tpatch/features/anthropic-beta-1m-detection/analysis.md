# Analysis: anthropic-beta 1M Context Detection

## Summary

The Claude Agent SDK activates 1M context via the `anthropic-beta: context-1m-2025-08-07` HTTP header, not via `[1m]` in the model name. The SDK strips `[1m]` and sends a clean model name. The proxy previously relied on a global `is1MContext` flag set at startup, missing per-request 1M signals from SDK callers.

## SDK Flow

```
Client: model = "claude-opus-4-6[1m]"
  → SDK strips [1m] → body.model = "claude-opus-4-6"
  → SDK adds header: anthropic-beta: context-1m-2025-08-07
  → Proxy receives request
  → Must check header → wants 1M
  → Must check catalog → claude-opus-4.6-1m exists
  → Forward with model = claude-opus-4.6-1m
```

## Files Modified

- `src/routes/messages/handler.ts` — `detectWants1M()`, per-request `is1M` threading
- `src/services/copilot/forward-native-messages.ts` — `buildNativeBody()` accepts `is1M` override
