# Spec: three-tier-routing-tests

## Problem Statement

The three-tier routing system (native passthrough, Responses API, chat/completions) and its payload sanitization have no automated tests. Regressions can only be caught by manual testing against live APIs, which is slow and unreliable.

## Acceptance Criteria

### Unit tests (pure functions, no network)

1. `src/lib/endpoint-routing.test.ts` exists and tests:
   - Claude models → `/v1/messages`
   - GPT-5.x models → `/responses`
   - GPT-4.x, Gemini, legacy → `/chat/completions`
   - Unknown models → `/chat/completions` fallback
   - Models with `-1m` suffix resolve correctly
2. `src/services/copilot/forward-native-messages.test.ts` exists and tests:
   - `thinking: { type: 'adaptive' }` → `{ type: 'enabled', budget_tokens: max(1024, max_tokens-1) }`
   - `budget_tokens` minimum enforced at 1024
   - `stop_sequences` whitespace-only entries filtered out
   - `stop_sequences` mixed entries: `['\n', 'END']` → `['END']`
   - `output_config.effort` mapped to thinking budget (low/medium/high/max)
   - Unknown fields not forwarded
3. `src/lib/model-mapping.test.ts` exists and tests:
   - `claude-opus-4-6` ↔ `claude-opus-4.6` conversion
   - `[1m]` suffix ↔ `-1m` suffix conversion
   - Unknown models pass through unchanged
4. All unit tests pass via `bun test`

### E2e tests (live API, opt-in)

5. `scripts/e2e-test-suite.ts` exists as a standalone script
6. Tests hit upstream API directly (not through proxy) to validate translation
7. Covers all three tiers: `/v1/messages`, `/responses`, `/chat/completions`
8. Uses minimal `max_tokens` (16-32 for text, 100-200 for tools)
9. Runnable via `bun run test:e2e` (opt-in, not in default test suite)

### Security

10. No tokens logged, stored in files, or hardcoded
11. Authorization headers redacted in error output
12. No real user data in test prompts (use synthetic: "Say ok", "What is 2+2")

## Out of Scope

- Testing upstream Copilot API behavior (we test our translation, not their API)
- CI integration (e2e tests are manual/opt-in only)
- Performance benchmarks
- Responses API response translation tests (defer until that path is more stable)

## Implementation Plan

### Phase 1: Unit tests
- Create `src/lib/endpoint-routing.test.ts` — test `resolveEndpoint()`
- Create `src/lib/model-mapping.test.ts` — test ID conversion functions
- Create `src/services/copilot/forward-native-messages.test.ts` — test `buildNativeBody()` sanitization

### Phase 2: E2e test script
- Create `scripts/e2e-test-suite.ts` — standalone script with assertion helpers
- Add `test:e2e` script to `package.json`
- Implement token redaction in error output

### Phase 3: Validation
- Run `bun test` to confirm all unit tests pass
- Run e2e suite once manually to confirm it works
