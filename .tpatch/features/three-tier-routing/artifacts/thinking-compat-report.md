# Thinking Type Compatibility Report — Copilot /v1/messages Endpoint

**Date**: 2026-04-27
**Tested by**: copilot-api proxy team
**Method**: Direct upstream probing (bypassing proxy normalization) — 9 models × 9 configurations = 81 API calls
**Proxy commit**: `f831904`

---

## How We Tested

We wrote a standalone probe script (`test-thinking-compat.ts`) that:

1. Bootstraps a Copilot token using the same auth flow as the proxy
2. Sends requests **directly** to `https://api.githubcopilot.com/v1/messages` — no proxy normalization, no field stripping
3. Tests every combination of `thinking.type`, `budget_tokens`, and `output_config.effort` against every Claude model in the catalog
4. Records PASS/FAIL and the exact error message for each combination

This gives us ground truth for what the upstream Copilot API actually accepts, independent of any proxy logic.

### Test configurations

| # | Label | Payload |
|---|-------|---------|
| 1 | no thinking | `{}` (no thinking field) |
| 2 | disabled | `thinking: { type: "disabled" }` |
| 3 | enabled+budget | `thinking: { type: "enabled", budget_tokens: 1024 }` |
| 4 | adaptive | `thinking: { type: "adaptive" }` |
| 5 | adaptive+budget | `thinking: { type: "adaptive", budget_tokens: 1024 }` |
| 6 | effort:low | `output_config: { effort: "low" }` |
| 7 | effort:high | `output_config: { effort: "high" }` |
| 8 | adaptive+effort:high | `thinking: { type: "adaptive" }, output_config: { effort: "high" }` |
| 9 | enabled+effort:high | `thinking: { type: "enabled", budget_tokens: 1024 }, output_config: { effort: "high" }` |

All tests used `max_tokens: 4096` and `messages: [{ role: "user", content: "Say PONG" }]`.

---

## Results

### Raw Results by Model

#### claude-haiku-4.5 (Older generation)
```
  no thinking               │ PASS │ [text]
  disabled                  │ PASS │ [text]
  enabled+budget            │ PASS │ [thinking, text]
  adaptive                  │ FAIL │ thinking: Input tag 'adaptive' not in expected tags: 'disabled', 'enabled'
  adaptive+budget           │ FAIL │ thinking: Input tag 'adaptive' not in expected tags: 'disabled', 'enabled'
  effort:low                │ FAIL │ output_config: Extra inputs are not permitted
  effort:high               │ FAIL │ output_config: Extra inputs are not permitted
  adaptive+effort:high      │ FAIL │ thinking: Input tag 'adaptive' not in expected tags: 'disabled', 'enabled'
  enabled+effort:high       │ FAIL │ output_config: Extra inputs are not permitted
```

#### claude-sonnet-4 (Older generation)
```
  no thinking               │ PASS │ [text]
  disabled                  │ PASS │ [text]
  enabled+budget            │ PASS │ [thinking, text]
  adaptive                  │ FAIL │ thinking: Input tag 'adaptive' not in expected tags: 'disabled', 'enabled'
  adaptive+budget           │ FAIL │ thinking: Input tag 'adaptive' not in expected tags: 'disabled', 'enabled'
  effort:low                │ FAIL │ output_config: Extra inputs are not permitted
  effort:high               │ FAIL │ output_config: Extra inputs are not permitted
  adaptive+effort:high      │ FAIL │ thinking: Input tag 'adaptive' not in expected tags: 'disabled', 'enabled'
  enabled+effort:high       │ FAIL │ output_config: Extra inputs are not permitted
```

#### claude-sonnet-4.5 (Older generation)
```
  (same pattern as sonnet-4 — enabled+budget PASS, adaptive FAIL, effort FAIL)
```

#### claude-opus-4.5 (Older generation)
```
  (same pattern as sonnet-4 — enabled+budget PASS, adaptive FAIL, effort FAIL)
```

#### claude-sonnet-4.6 (4.6 generation)
```
  no thinking               │ PASS │ [text]
  disabled                  │ PASS │ [text]
  enabled+budget            │ PASS │ [thinking, text]
  adaptive                  │ PASS │ [thinking, text]
  adaptive+budget           │ FAIL │ thinking.adaptive.budget_tokens: Extra inputs are not permitted
  effort:low                │ PASS │ [text]
  effort:high               │ PASS │ [thinking, text]
  adaptive+effort:high      │ PASS │ [thinking, text]
  enabled+effort:high       │ PASS │ [thinking, text]
```

#### claude-opus-4.6 (4.6 generation)
```
  (same pattern as sonnet-4.6 — all PASS except adaptive+budget)
```

#### claude-opus-4.6-1m (4.6 generation)
```
  (same pattern as sonnet-4.6 — all PASS except adaptive+budget)
```

#### claude-opus-4.7 (4.7 generation — base)
```
  no thinking               │ PASS │ [text]
  disabled                  │ PASS │ [text]
  enabled+budget            │ FAIL │ "thinking.type.enabled" is not supported for this model. Use "thinking.type.adaptive"
  adaptive                  │ PASS │ [thinking, text]
  adaptive+budget           │ FAIL │ thinking.adaptive.budget_tokens: Extra inputs are not permitted
  effort:low                │ FAIL │ output_config: Extra inputs are not permitted
  effort:high               │ FAIL │ output_config: Extra inputs are not permitted
  adaptive+effort:high      │ FAIL │ output_config: Extra inputs are not permitted
  enabled+effort:high       │ FAIL │ "thinking.type.enabled" is not supported for this model
```

#### claude-opus-4.7-1m-internal (4.7 generation — 1m variant)
```
  no thinking               │ PASS │ [text]
  disabled                  │ PASS │ [text]
  enabled+budget            │ FAIL │ "thinking.type.enabled" is not supported for this model. Use "thinking.type.adaptive"
  adaptive                  │ PASS │ [thinking, text]
  adaptive+budget           │ FAIL │ thinking.adaptive.budget_tokens: Extra inputs are not permitted
  effort:low                │ PASS │ [text]
  effort:high               │ PASS │ [thinking, text]
  adaptive+effort:high      │ PASS │ [thinking, text]
  enabled+effort:high       │ FAIL │ "thinking.type.enabled" is not supported for this model
```

---

### Summary Matrix

```
                                no-think  disabled  enabled  adaptive  adapt+budget  effort  adapt+effort
haiku-4.5                          ✅        ✅       ✅       ❌          ❌          ❌        ❌
sonnet-4                           ✅        ✅       ✅       ❌          ❌          ❌        ❌
sonnet-4.5                         ✅        ✅       ✅       ❌          ❌          ❌        ❌
opus-4.5                           ✅        ✅       ✅       ❌          ❌          ❌        ❌
sonnet-4.6                         ✅        ✅       ✅       ✅          ❌          ✅        ✅
opus-4.6                           ✅        ✅       ✅       ✅          ❌          ✅        ✅
opus-4.6-1m                        ✅        ✅       ✅       ✅          ❌          ✅        ✅
opus-4.7                           ✅        ✅       ❌       ✅          ❌          ❌        ❌
opus-4.7-1m-internal               ✅        ✅       ❌       ✅          ❌          ✅        ✅
```

---

## Comparison With Your Findings

### What you got right

| Finding | Status |
|---------|--------|
| Older models: `disabled` + `enabled` only | ✅ Confirmed |
| 4.6 models: accept everything | ✅ Confirmed (with one exception — see below) |
| 4.7 models: reject `enabled` | ✅ Confirmed |
| 4.7 models: `adaptive` only | ✅ Confirmed |
| opus-4.7 base rejects `output_config.effort` | ✅ Confirmed |
| opus-4.7-1m-internal accepts `output_config.effort` | ✅ Confirmed |
| Future models should default to `adaptive` | ✅ Agree (trend is clear) |

### What needs correction

#### 1. `adaptive` NEVER accepts `budget_tokens`

Your report didn't mention this. On **every** model (4.6 and 4.7 alike), sending `thinking: { type: "adaptive", budget_tokens: N }` returns:

```
thinking.adaptive.budget_tokens: Extra inputs are not permitted
```

`budget_tokens` is only accepted with `type: "enabled"`. If you need to control token budget, use `enabled` (on models that support it) or use `output_config.effort` (on models that support it). `adaptive` is a "let the model decide" mode — it doesn't accept budget constraints.

**Impact on your code**: If your translator sets `budget_tokens` on adaptive thinking, it will 400 on every model.

#### 2. 4.6 models DO support `enabled+budget`

Your table showed:

```
│ 4.6 │ sonnet-4.6, opus-4.6, opus-4.6-1m │ ✅ │ ✅ │ ✅ │ ✅ │
```

This is correct — but the `adaptive+effort` column (✅) might imply `adaptive` accepts `budget_tokens`. It doesn't. 4.6 models support:
- `enabled` + `budget_tokens` ✅
- `adaptive` (no budget) ✅
- `output_config.effort` ✅
- `adaptive` + `output_config.effort` ✅
- `adaptive` + `budget_tokens` ❌

#### 3. `enabled` requires `budget_tokens` — it's not optional

Sending `thinking: { type: "enabled" }` without `budget_tokens` returns:

```
thinking.enabled.budget_tokens: Field required
```

This applies to all models that support `enabled`. Your code should always include `budget_tokens` when using `enabled`.

#### 4. `output_config.effort` is rejected by ALL older models

Your report focused on thinking types but didn't cover `output_config.effort` on older models. We confirmed: haiku-4.5, sonnet-4/4.5, and opus-4.5 all reject `output_config` entirely with "Extra inputs are not permitted".

---

## Recommended Normalization Logic

Based on our verified findings, here's the normalization we implemented:

```typescript
// 1. Detect model generation
const OLDER_MODELS = ["haiku-4.5", "sonnet-4.5", "sonnet-4", "opus-4.5"]

function detectGeneration(copilotModelId: string) {
  if (OLDER_MODELS.some(m => copilotModelId.includes(m))) return "older"
  if (copilotModelId.includes("4.6")) return "4.6"
  return "4.7+"  // default future models to adaptive
}

// 2. Normalize thinking type
function normalizeThinking(thinking, maxTokens, generation) {
  const type = thinking?.type ?? "enabled"

  if (type === "disabled") return { type: "disabled" }

  switch (generation) {
    case "4.6":
      // 4.6 accepts both — pass through as-is
      // But adaptive NEVER accepts budget_tokens
      if (type === "adaptive") return { type: "adaptive" }
      return { type: "enabled", budget_tokens: Math.min(budget, maxTokens - 1) }

    case "4.7+":
      // 4.7+ rejects enabled — must use adaptive (no budget_tokens ever)
      return { type: "adaptive" }

    default: // older
      // Older rejects adaptive — must use enabled (always needs budget_tokens)
      return { type: "enabled", budget_tokens: Math.min(budget, maxTokens - 1) }
  }
}

// 3. Forward output_config.effort only to models that support it
function supportsEffort(generation, modelId) {
  if (generation === "4.6") return true
  if (generation === "4.7+" && modelId.includes("-1m")) return true
  return false  // older models and 4.7 base reject it
}

// In the request builder:
if (effort && supportsEffort(generation, modelId)) {
  body.output_config = { effort }
}
```

### Key rules to remember

1. **`adaptive` + `budget_tokens` = always 400.** Never combine them.
2. **`enabled` without `budget_tokens` = always 400.** Always include budget.
3. **`budget_tokens` must be < `max_tokens`.** Clamp it.
4. **Default unknown/future models to `adaptive`.** The trend is clear.
5. **`output_config.effort`**: only 4.6 and 4.7-1m. Strip for everything else.

---

## Appendix: Test Script

The probe script is available at `src/test-thinking-compat.ts` in our repo. To reproduce:

```bash
# Requires auth (copilot-api's stored GitHub token)
bun run src/test-thinking-compat.ts
```

It bootstraps a Copilot token, hits the upstream API directly (no proxy), and prints the full matrix. Takes ~3 minutes for all 81 calls.
