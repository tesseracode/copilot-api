# Exploration

- `scripts/proxy-model-validation.ts:37` — replace the absolute machine-local import with a
  relative one (`./lib/copilot-test-lib`). Lines 524/526 (implicit-`any` on filter callbacks)
  resolve automatically once the import brings real types back.
- `scripts/lib/copilot-test-lib.ts` (new) — reconstruct using only established, already-committed
  patterns from this repo: `copilotHeaders`/`copilotBaseUrl` from `~/lib/api-config`,
  `getCopilotToken` from `~/services/github/get-copilot-token`, `Model`/`ModelsResponse` from
  `~/services/copilot/get-models`, `resolveEndpoint` from `~/lib/endpoint-routing`, `PATHS` from
  `~/lib/paths`, and `state` from `~/lib/state` — the same building blocks
  `scripts/context-boundary-validation.ts` already uses for the same job (auth via the persisted
  `github_token` file, exchange for a Copilot token, direct fetch against
  `https://api.githubcopilot.com`).
- `src/lib/tokenizer.ts:57-58` — narrow `part.type === "text"` before reading `part.text` on the
  `TextPart | AudioPart` union instead of relying on truthiness of `part.text`.
- `src/services/copilot/create-responses.ts` (`makeChunk`, 5 call sites) — `Delta` needs an index
  signature (or the call sites need a compatible cast) to satisfy `Record<string, unknown>`.
- `tests/anthropic-response.test.ts:117,124` — narrow the constructed event object's literal
  type (e.g. `satisfies`/explicit variable typing) before passing to helpers expecting
  `AnthropicToolStartEvent` / `AnthropicInputJsonDeltaEvent`.
- `tests/messages-tool-result-validation.test.ts`, `tests/responses-stream-arg-divergence-guard.test.ts`,
  `tests/responses-stream-error-events.test.ts` — `spyOn(consola, "warn").mockImplementation(() => {})`
  needs a mock matching consola's `LogFn` (add a no-op `raw` method to the mock implementation).
- `tests/pricing-updater-recovery.test.ts:20,30,39` — fetch mocks need a `preconnect` no-op to
  satisfy `typeof fetch`.
- `src/services/copilot/forward-native-messages.test.ts:44` — split the 242-line `describe`
  callback into smaller `describe` blocks (no behavior change) to satisfy `max-lines-per-function`.
