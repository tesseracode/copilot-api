# Analysis

`bun test` (202 pass) is green, but the two gates that actually enforce type-safety and
style — `bun run typecheck` (`tsc`, also this project's configured `tpatch` `test_command`)
and `bun run lint:all` (`eslint --cache .`) — currently fail. Nothing has caught this because
`.github/workflows/ci.yml` runs all four gates (lint:all, typecheck, test, build) on every
push/PR to `master`, but `gh run list` shows zero workflow runs ever: this repo is a fork,
and GitHub disables Actions on forks by default until a maintainer manually enables them.
`bun run build` (tsdown) also passes, but only bundles `src/main.ts` so it never touches
`scripts/` or `tests/`.

`npx tsc --noEmit` reports 25 errors across 8 files, in three unrelated clusters:

1. **Portability bug (new, 2026-07)**: `scripts/proxy-model-validation.ts` imports from an
   absolute, machine-specific path (`/Users/jbencardino/.../copilot-test-lib`) that was never
   committed to this repo (confirmed via `git log --all` on every branch/stash, and identical
   on `origin/master`). This breaks the script for everyone except the original author's
   machine. Two more TS7006 implicit-`any` errors sit in the same file.
2. **April 2026 streaming-stability batch regressions**: `create-responses.ts` (5 errors) and
   4 test files (14 errors) drifted out of sync with type changes made during that batch —
   `consola`'s `LogFn` type now requires a `raw` method that test mocks don't implement, a
   `fetch` mock is missing `preconnect`, and `Delta` lost its index signature relative to
   `Record<string, unknown>`.
3. **Pre-fork legacy (2025-08-30, upstream)**: `src/lib/tokenizer.ts` duck-types `part.text` on
   a `TextPart | AudioPart` union without narrowing on `part.type` first.

`bun run lint:all` fails separately on one `max-lines-per-function` violation in
`forward-native-messages.test.ts` (242 lines in one `describe` callback, introduced in the
same April 2026 batch).

None of these are behavioral bugs — they are type-safety, lint, and portability debt. Fix
is compatible with all upstream/fork policies; no runtime logic should change.
