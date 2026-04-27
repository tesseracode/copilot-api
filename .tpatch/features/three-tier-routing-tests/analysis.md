# Analysis: three-tier-routing-tests

## Summary

Build a comprehensive test suite validating the three-tier endpoint routing system and all associated translation/sanitization logic. Based on a reference implementation with 57 unit tests + 13 e2e tests.

Coverage areas:
- **Endpoint routing** — Claude → `/v1/messages`, GPT-5.x → `/responses`, legacy → `/chat/completions`
- **Payload sanitization** — thinking normalization, stop_sequences stripping, output_config dropping, effort mapping
- **Responses API translation** — request translation (Anthropic → OpenAI Responses) and response translation (back to Anthropic format)
- **Model mapping** — ID format conversion (dots ↔ dashes), 1M context suffix handling
- **E2e validation** — live API calls across all three tiers with real models

## Upstream Status

Not present upstream. These tests are specific to our proxy's translation and routing logic.

## Compatibility

- **No runtime impact.** Test files only — no production code changes.
- **Test runner:** Uses `bun:test` (already available in the project).
- **E2e tests:** Opt-in via separate script (`bun run test:e2e`), not part of default test suite. Makes real API calls against Copilot quota.
- **Dependency:** Requires `three-tier-routing` (applied) and `native-payload-sanitization` (in progress).

## Risks

- **Security:** E2e tests handle live Copilot tokens. Must never log, store in files, or commit tokens. Authorization headers must be redacted in error output.
- **Cost:** E2e tests consume Copilot API quota. Mitigated by minimal `max_tokens` (16-32 for text, 100-200 for tools) and opt-in execution.
- **Flakiness:** E2e tests depend on upstream API availability. Should not run in CI loops.

## Files to Create

- `src/lib/endpoint-routing.test.ts` — routing unit tests
- `src/services/copilot/forward-native-messages.test.ts` — sanitization unit tests
- `src/lib/model-mapping.test.ts` — model ID mapping tests
- `src/services/copilot/create-responses.test.ts` — Responses API translation tests (if applicable)
- `scripts/e2e-test-suite.ts` — standalone e2e test script
