# Specification

1. `bun run typecheck` (`tsc`) exits 0 — zero TypeScript errors, across `src/`, `scripts/`,
   and `tests/`.
2. `bun run lint:all` (`eslint --cache .`) exits 0 — zero lint errors/warnings.
3. `bun test` still exits 0 with the existing 202 tests passing (no regressions, no test
   deleted or skipped to dodge a type error).
4. `bun run build` (tsdown) still exits 0 and still bundles only `src/main.ts`.
5. `scripts/proxy-model-validation.ts` resolves its helper import from a path committed
   inside this repository (`scripts/lib/copilot-test-lib.ts`), not from any machine-local
   absolute path. The script remains runnable via `bun run scripts/proxy-model-validation.ts`
   against a live proxy (import resolution only — a live Copilot backend is out of scope for
   this feature's automated tests).
6. No runtime/behavioral change: every fix is a type annotation, type guard, mock signature,
   or refactor-for-line-count change. Response payloads, translation logic, and route
   behavior are byte-for-byte unchanged.
7. The new `scripts/lib/copilot-test-lib.ts` module is committed, type-checks cleanly, and
   exports exactly the members `scripts/proxy-model-validation.ts` and
   `scripts/context-boundary-validation.ts`-style scripts need: `getJwt`, `fetchModels`,
   `filterChatModels`, `classifyModel`, `copilotHeaders`, `proxyHeaders`, `fmtMs`,
   `COPILOT_API_BASE_URL`, `PROXY_URL`, and the `CopilotModel` / `ModelProfile` / `TestResult`
   types.
