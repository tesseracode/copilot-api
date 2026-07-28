# Handoff — 2026-07-28

Session context for resuming on another machine. **Delete this file once you've resumed** — it
is a snapshot, not durable documentation. Durable facts belong in `CLAUDE.md`; architecture
decisions belong in `.tpatch/RETROSPECTIVE.md`.

## Where things stand

- `origin/master` = `9821e54` (plus whatever commit adds this file). Working tree clean, all
  work pushed.
- **238 tests passing**, up from 202 at the start of the session.
- All four gates green: `bun run typecheck`, `bun run lint:all`, `bun test`, `bun run build`.
- **45 tpatch features**: 40 `applied`, 5 `requested` (deliberately deferred, listed below).

## What happened this session

Two threads, both complete.

**1. Stabilisation.** `bun run typecheck` and `bun run lint:all` had been silently failing for
~3 months (25 TS errors, 1 ESLint error) because this fork's CI has never executed. Fixed all of
them. Also recreated `scripts/lib/copilot-test-lib.ts`, which had only ever existed as a
hardcoded absolute path to a file on the original author's machine.

**2. Architecture review** using the `improve-codebase-architecture` skill. Six candidates
surfaced, all six dispositioned:

| # | Candidate | Outcome |
|---|---|---|
| 1 | Seam under route handlers | premise wrong — coverage shipped, seam deferred |
| 2 | Duplicated SSE pump | done as proposed |
| 3 | Translation in chat handler | done — **2 live defects fixed** |
| 4 | Tool-call assembly | rejected, evidence in `RETROSPECTIVE.md` |
| 5 | Global `state` in internals | rejected, evidence in `RETROSPECTIVE.md` |
| 6 | Error shape at route seam | **inverted** — real defect found and fixed |

**Five of six were materially wrong as written.** Only candidate 2 survived measurement intact.
That is the transferable lesson: the report generated good hypotheses and bad decisions. Measure
before acting.

Defects actually fixed: Claude streaming tool calls were being silently dropped on
`/chat/completions`; client disconnects weren't propagating on that path; `/v1/messages` returned
malformed error envelopes whenever the proxy raised the error itself.

## Outstanding — start here

### 1. Verify GitHub Actions actually runs (highest value, ~5 min)

CI has **never executed once** on this repo — `total_count: 0` runs, despite 8 pushes in one
day. That is what let the gates rot. The API reports `enabled: true` and all workflows `active`,
so the block is GitHub's fork gate, which the REST API does not expose.

Attempted from the CLI this session, both returning success but with no observed effect:
```sh
gh api -X PUT repos/tesseracode/copilot-api/actions/permissions -F enabled=true -f allowed_actions=all
gh workflow enable ci.yml -R tesseracode/copilot-api
```

**Two blockers, in order:**

**(a) The `gh` token lacks the `workflow` scope.** Adding `workflow_dispatch` to
`.github/workflows/ci.yml` was attempted and the push was rejected:

> `refusing to allow an OAuth App to create or update workflow .github/workflows/ci.yml without
> workflow scope`

Current scopes on `jdbencardinop` are `admin:org, gist, repo`. So **no workflow file can be
modified from this CLI at all** until you run:
```sh
gh auth refresh -h github.com -s workflow
```
That change was therefore reverted, and `ci.yml` is untouched on `master`. If you want manual CI
triggering, re-apply it after refreshing the scope:
```yaml
on:
  push:
    branches: [master]
  pull_request:
    types: [opened, synchronize, reopened]
  workflow_dispatch:          # <- add this
```

**(b) The fork gate almost certainly needs a human click.** Even with permissions enabled and
workflows active, forks keep workflows dormant until someone visits **repo → Actions tab →
"I understand my workflows, go ahead and enable them"**. No API exposes this.

Quickest check on the new machine: push any commit, then
`gh run list -R tesseracode/copilot-api --limit 3`. If it is still empty, do the UI click. The
workflow itself is correct and would pass today — all four gates are green.

### 2. File the retrospective upstream (~10 min)

`.tpatch/RETROSPECTIVE.md` Part 2 contains feedback for `tpatch` itself, aimed at
`tesseracode/tesserapatch` (public, issues enabled, has a `docs/` dir). Two substantive asks:

- **2.1 — no first-class `supersedes` edge.** `FEATURES.md` currently asserts that two mutually
  exclusive mechanisms are both `applied`. Proposed as a sibling to the existing
  `tpatch amend --depends-on parent[:hard|:soft]`.
- **2.2 — `write-file` recipe ops can silently revert later fixes.** Hit for real this session: a
  recipe embedded a stale 28KB copy of a file that a later feature had fixed. A recipe operation
  that *cannot fail* is more dangerous than one that can.

Plus 2.3, smaller observations. Filing as an issue was the plan; a docs PR is also viable.

### 3. Deferred features (no deadline, each has a trigger)

Filed this session:
- `stream-failure-visibility` — a non-abort mid-stream failure truncates silently; the client
  can't distinguish it from a completed stream. Real, client-visible. **The most substantive of
  the three.**
- `streaming-response-discriminated-union` — low priority; the sound `Symbol.asyncIterator`
  predicate already removed the actual hazard.
- `claude-thinking-reasoning-text` — **do not build without a confirmed consumer.** A survey of
  the whole intended stack found none.

Pre-existing, untouched: `error-differentiation`, `reasoning-roundtrip` (the latter blocked
upstream).

Also open: `.tpatch/POTENTIAL_FEATURES.md` items 1, 2, 4, 5, 6, 7 (item 3 was retired by
`sse-pump-consolidation`). All still lack triggers.

## Environment needed on the new machine

- **bun** ≥ 1.2 (`bun install` after cloning).
- **tpatch** — compiled Go binary on `PATH`, v0.11.1 this session. Not an npm package; never wrap
  it in `npx`/`npm run`.
- **`gh` authenticated as `jdbencardinop`.** This matters: the account flipped to
  `juanbe_microsoft` mid-session and pushes started failing with 403, because git's credential
  helper for github.com is `!/usr/bin/gh auth git-credential` and follows whichever account is
  *active*. Fix: `gh auth switch --user jdbencardinop`.
- **The token lacks the `workflow` scope** (`admin:org, gist, repo`), so any commit touching
  `.github/workflows/**` will be rejected at push time. Run `gh auth refresh -h github.com -s
  workflow` if you need to change a workflow file.
- **A GitHub token** at `~/.local/share/copilot-api/github_token` (run `bun run dev auth` if
  absent).
- **The proxy running on `:4141`** for any live verification — `bun run dev start`. Note tpatch's
  own provider is configured against it (`.tpatch/config.yaml`: `claude-haiku-4.5` via
  `http://localhost:4141`), so tpatch's LLM phases need it up. Path B (`--manual`) doesn't.

## Gotchas worth knowing

- **A pre-commit hook runs `bun run lint --fix` on staged files** and can reformat your work
  mid-commit. Re-run the gates after committing, not just before.
- **`tpatch record <slug>` on already-committed work silently captures only the working tree**,
  shrinking the recipe to whatever was uncommitted. Use `--from <base>`.
- **Path B is normal.** The configured provider is a lightweight local model; when you already
  have more context than it does, author the artifacts yourself and use `--manual`.
- **Mutation-test your tests.** This session, six abort tests passed against a deliberately
  broken helper — they were vacuous. Breaking the code on purpose is the only way that surfaced.
- **On WSL, `xdg-open` is not installed.** Use `powershell.exe -NoProfile -Command "Start-Process
  '<windows-path>'"`, and copy files to a Windows-native path first. `wslview` fails here because
  `wslu` greps for a `WSLInterop` binfmt entry that is now named `WSLInterop-late`.
- **Verify a premise before acting on it.** Five of six review candidates didn't survive
  measurement, and the two live defects were both found that way rather than by reading code.

## Resume prompt

See `## Prompt for the next machine` in the handoff message, or reconstruct from this file — the
key instruction is to read `CLAUDE.md`, `.tpatch/RETROSPECTIVE.md`, and this file first, then
pick up at "Outstanding" above.
