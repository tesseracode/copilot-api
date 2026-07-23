# Exploration

- `src/services/copilot/get-models.ts`: authoritative catalog limits and endpoint metadata.
- `src/lib/endpoint-routing.ts`: endpoint selection policy to mirror.
- `src/lib/tokenizer.ts`: local chat token estimate used for prompt calibration.
- `src/services/copilot/create-{chat-completions,responses}.ts`: response usage shapes.
- `src/services/github/get-copilot-usage.ts` and `/usage`: account quota and `credits_used` snapshots.
- `scripts/proxy-model-validation.ts`: direct/proxy blame concept, but its external absolute import is not reused.
- New pure helpers belong in `scripts/lib/context-boundary.ts`; CLI orchestration in `scripts/context-boundary-validation.ts`; tests in `tests/context-boundary-validation.test.ts`.
