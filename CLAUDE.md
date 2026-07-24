# Project Notes

Durable facts and preferences for AI agents working in this repo. This file
replaces the Copilot "memory" feature — when asked to *remember* / *write in
memory*, append here instead of calling any memory tool.

---

## Preferences

- **Do not use the Copilot `store_memory` tool.** Record durable facts in this
  file instead. (The hosted memory service also currently rejects writes on this
  account: it requires a *Usage billed to* entity, and the account has 9
  candidates — personal plus 8 orgs — with no default selected.)

---

## Build / validation

- **CI has never actually run on this repo.** `.github/workflows/ci.yml` defines
  four gates on every push/PR to `master`, but `tesseracode/copilot-api` is a
  fork and GitHub disables Actions on forks by default — `gh run list` returns
  zero runs. Nothing is enforced remotely.
- **Run all four gates locally before committing:**
  ```sh
  bun run typecheck && bun run lint:all && bun test && bun run build
  ```
  `bun test` alone is not sufficient: it does not type-check, and `bun run build`
  (tsdown) only bundles `src/main.ts`, so neither covers `scripts/` or `tests/`.
  Letting these drift is how 25 TypeScript errors and 1 ESLint error accumulated
  undetected for ~3 months while the test suite stayed green.

## Model handling

- **Derive model capabilities from the live catalog, never from hardcoded
  model-name or version heuristics.** Read `supported_endpoints`,
  `adaptive_thinking`, and `reasoning_effort` from the `/models` response — see
  `src/lib/endpoint-routing.ts` (`resolveEndpoint`) and `src/lib/effort.ts`
  (`resolveEffort`) for the pattern, and `scripts/lib/copilot-test-lib.ts`
  (`classifyModel`) for the same approach in tooling.
  Heuristics like `id.includes("4.6")` go stale silently: they misreported
  `claude-opus-4.8`, `claude-opus-5`, and `claude-sonnet-5` as
  `thinking=enabled-only` / `effort=none` when all three advertise
  `adaptive_thinking` and a full `reasoning_effort` range, and reported
  `effort=none` for every GPT-5.x and Gemini model that supports it.
- **Effort suffixes (`-high` / `-xhigh`) and `-1m` variants are legacy.** Upstream
  no longer advertises them; Claude 4.6+ is natively 1M context and effort rides
  in `output_config.effort`. Suffix handling that remains is backward-compat only
  (see the `api-context-effort-migration` tpatch feature).
- `model_picker_category` (`powerful` / `versatile` / `lightweight`) is only a
  Copilot picker-UI grouping. It drives no routing and is passed through as-is.

## Tooling

- `tpatch` is a compiled Go binary on `PATH`; never wrap it with `npx`/`npm run`.
  There is **no** `tpatch install` subcommand — `tpatch init` installs the
  workspace and skill formats.
- Path B (agent-authored artifacts + `tpatch <phase> --manual`) is a normal,
  supported workflow, not a fallback. The configured provider for this repo is a
  lightweight local model (`claude-haiku-4.5` via the proxy on `:4141`), so
  prefer Path B whenever you already hold more context than it would.
- When recording a feature that is already committed, use
  `tpatch record <slug> --from <base>` — a plain `tpatch record` captures only the
  working tree and will shrink the recipe to the uncommitted delta.
