# Upstream Model ID Return Behavior — Copilot /v1/messages

**Date**: 2026-04-28
**Method**: Direct upstream probe (no proxy normalization) — 11 Claude models

## Findings

The upstream Copilot `/v1/messages` endpoint **always returns Anthropic dash-format model IDs** and **always strips all suffixes** (-1m, -internal, -high, -xhigh). Older models additionally append a date suffix.

```
SENT (Copilot dot format)       → RETURNED (Anthropic dash format)
────────────────────────────────────────────────────────────────────
claude-haiku-4.5                → claude-haiku-4-5-20251001
claude-sonnet-4                 → claude-sonnet-4-20250514
claude-sonnet-4.5               → claude-sonnet-4-5-20250929
claude-opus-4.5                 → claude-opus-4-5-20251101
claude-sonnet-4.6               → claude-sonnet-4-6
claude-opus-4.6                 → claude-opus-4-6
claude-opus-4.6-1m              → claude-opus-4-6
claude-opus-4.7                 → claude-opus-4-7
claude-opus-4.7-high            → claude-opus-4-7
claude-opus-4.7-xhigh           → claude-opus-4-7
claude-opus-4.7-1m-internal     → claude-opus-4-7
```

## Key observations

### 1. The upstream always converts to Anthropic dash notation
Copilot stores models in dot format (`claude-opus-4.6`) but the `/v1/messages` endpoint returns them in Anthropic dash format (`claude-opus-4-6`). This means our `copilotToAnthropicModelId` reverse mapping is technically redundant for the native passthrough path — the upstream does it for us.

### 2. ALL suffixes are stripped by the upstream
- `-1m` → stripped (opus-4.6-1m returns opus-4-6)
- `-1m-internal` → stripped (opus-4.7-1m-internal returns opus-4-7)
- `-high` → stripped (opus-4.7-high returns opus-4-7)
- `-xhigh` → stripped (opus-4.7-xhigh returns opus-4-7)

The response model is always the **base model identity**. This confirms:
- Effort suffix stripping in our `copilotToAnthropicModelId` is defensive but aligned with upstream behavior
- The client cannot distinguish which variant was actually used from the response alone

### 3. Older models append date suffixes
- haiku-4.5 → `claude-haiku-4-5-20251001`
- sonnet-4 → `claude-sonnet-4-20250514`
- sonnet-4.5 → `claude-sonnet-4-5-20250929`
- opus-4.5 → `claude-opus-4-5-20251101`

4.6+ models do not append date suffixes.

### 4. No dot-format ever appears in responses
The upstream converts dots to dashes before returning. `claude-opus-4.6` is never returned — always `claude-opus-4-6`.

## Implications for our proxy

| Concern | Status |
|---------|--------|
| Effort suffix stripping | ✅ Defensive — upstream already does it |
| `-internal` stripping | ✅ Defensive — upstream already does it |
| `-1m` → `[1m]` mapping | ❌ **Lost** — upstream returns `claude-opus-4-6` for both 1m and non-1m requests. Client can't distinguish. |
| Date suffix handling | ⚠️ `copilotToAnthropicModelId` doesn't strip date suffixes — client sees `claude-sonnet-4-20250514` verbatim |
| Dot→dash conversion | ✅ Upstream handles it — our mapping is redundant for native passthrough |

### The 1M model identity problem

When we send `claude-opus-4.6-1m`, the upstream returns `claude-opus-4-6`. The client loses the `[1m]` signal. This doesn't cause functional issues (the response already used 1M context), but it means:
- The client can't verify 1M was actually used from the response model field
- Multi-turn: the client would send back `claude-opus-4-6` without `[1m]`, relying on the `anthropic-beta` header or `is1MContext` to re-upgrade

This is acceptable — the 1M signal is in the request, not the response.
