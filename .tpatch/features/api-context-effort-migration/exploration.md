# Exploration: api-context-effort-migration

# Relevant Files (manually verified)

## Primary — Effort handling lives here
- **src/services/copilot/forward-native-messages.ts** — Contains `supportsEffort()`, `resolveEffort()`, `resolveEffortSuffix()`, `normalizeThinking()`, `buildNativeBody()`. This is the main file to refactor.
- **src/services/copilot/forward-native-messages.test.ts** — Unit tests for `buildNativeBody()` including effort mapping, thinking normalization, stop_sequences sanitization.

## Secondary — Model mapping (dead suffix code lives here)
- **src/lib/model-mapping.ts** — Contains `EFFORT_SUFFIXES`, `anthropicToCopilotModelId()` with `-1m`/`-1m-internal` resolution, effort suffix stripping. Dead code to remove.
- **src/lib/model-mapping.test.ts** — Tests for suffix resolution. Tests to simplify.

## Tertiary — GPT-5.x effort forwarding
- **src/services/copilot/create-responses.ts** — `translateRequestToResponses()` builds the /responses payload. Has `reasoning?: {effort: string}` type defined but never populated.

## Context — No changes needed but referenced
- **src/routes/messages/handler.ts** — Calls `anthropicToCopilotModelId()` and `forwardNativeMessagesStreaming/NonStreaming()`. The `detectWants1M()` function and `anthropic-beta` header detection can stay (harmless no-op).
- **src/lib/state.ts** — `is1MContext` flag. Can stay for backward compat.
- **src/services/copilot/get-models.ts** — Model type includes `capabilities` with `reasoning_effort`. No changes needed — it passes upstream response through.
- **src/lib/filter-models.ts** — Only filters by vendor/internal. NOT affected (no synthetic variants created here).
- **src/routes/messages/non-stream-translation.ts** — Anthropic→OpenAI translation for /chat/completions models. No effort handling here.

---

# Minimal Changeset (corrected)

## 1. **src/services/copilot/forward-native-messages.ts** (PRIMARY)

### Bug 1 fix: Remove `max` → `xhigh` normalization
```typescript
// BEFORE (line ~193):
const normalizedEffort = effort === "max" ? "xhigh" : effort
// AFTER:
// Send effort as-is — the API validates per model
```

### Bug 2 fix: `supportsEffort()` should check capabilities, not ID
```typescript
// BEFORE:
function supportsEffort(generation: ModelGeneration, copilotModelId: string): boolean {
  if (generation === "4.6") return true
  if (generation === "4.7+" && copilotModelId.includes("-1m")) return true // ← always false
  return false
}

// AFTER: Check model capabilities from state
function supportsEffort(copilotModelId: string): boolean {
  const model = state.models?.data.find((m) => m.id === copilotModelId)
  const efforts = (model?.capabilities as Record<string, unknown>)?.supports as Record<string, unknown> | undefined
  const arr = efforts?.reasoning_effort
  return Array.isArray(arr) && arr.length > 0
}
```

### Remove dead suffix logic
- Delete `resolveEffortSuffix()` function entirely
- In `resolveEffort()`: remove the `-high`/`-xhigh` catalog lookup branch
- Simplify to: if model supports effort → forward `output_config.effort` directly (no normalization)

### Simplify `resolveEffort()`
```typescript
function resolveEffort(opts: ResolveEffortOpts): boolean {
  const { copilotModelId, effort, body, outputConfig } = opts
  if (!effort) return false
  if (supportsEffort(copilotModelId)) {
    body.output_config = { ...outputConfig, effort }
    return true
  }
  return false
}
```

## 2. **src/lib/model-mapping.ts** (CLEANUP)

### Remove `EFFORT_SUFFIXES` handling
- Remove `const EFFORT_SUFFIXES = ["-xhigh", "-high"] as const`
- In `anthropicToCopilotModelId()`: remove effort suffix stripping + re-appending logic
- In `copilotToAnthropicModelId()`: remove effort suffix stripping (lines 103-109)

### Simplify `-1m` resolution
- Keep `[1m]` suffix stripping (Claude Code still sends it)
- Keep `-1m` catalog check (graceful fallback — finds nothing, returns base model)
- Remove `-1m-internal` fallback (no longer exists)

## 3. **src/services/copilot/create-responses.ts** (GPT-5.x effort)

### Populate `reasoning.effort` in `translateRequestToResponses()`
```typescript
export function translateRequestToResponses(
  payload: ChatCompletionsPayload,
  effort?: string,  // ← new param
): ResponsesPayload {
  const result: ResponsesPayload = { ... }
  if (effort) result.reasoning = { effort }
  return result
}
```

### Thread effort from handler
In `src/routes/messages/handler.ts` → `handleResponsesViaAnthropic()`:
- Extract `payload.output_config?.effort` from the original Anthropic payload
- Pass it through to `translateRequestToResponses()`

## 4. **Tests** (update mocks, add effort tests)

### `src/services/copilot/forward-native-messages.test.ts`
- Update `setCatalog()` to include `reasoning_effort` in model capabilities
- Fix effort tests: `max` effort should produce `output_config: {effort: "max"}` (not budget mapping)
- Add test: opus-4.7 with effort=xhigh → `output_config: {effort: "xhigh"}`
- Add test: opus-4.6 with effort=xhigh → forward as-is, let API validate

### `src/lib/model-mapping.test.ts`
- Remove effort suffix tests (no longer relevant)
- Keep [1m] suffix stripping tests (backward compat)
- Simplify `-1m-internal` tests (remove or keep as graceful no-op)

## 5. **NOT changing** (no-op, keep for backward compat)
- `src/routes/messages/handler.ts` — `detectWants1M()` stays (harmless)
- `src/lib/state.ts` — `is1MContext` stays (used for logging/display)
- `src/lib/filter-models.ts` — Not affected
- `src/services/copilot/get-models.ts` — Not affected (passthrough)
