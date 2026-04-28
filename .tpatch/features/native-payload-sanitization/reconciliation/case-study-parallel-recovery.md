---
name: tpatch-case-study-parallel-recovery
description: Case study analyzing tpatch methodology after recovering from a parallel agent that reverted payload sanitization changes
type: project
---

# Case Study: Parallel Agent Recovery with Tessera Patch

## The Scenario

We were implementing two features on `copilot-api`:
1. **`native-payload-sanitization`** — strip whitespace-only `stop_sequences`, map `output_config.effort` to thinking budgets
2. **`three-tier-routing-tests`** — 67 unit tests covering endpoint routing, model mapping, and payload sanitization

Mid-implementation, a parallel agent (likely triggered by a linter hook or simplify skill) refactored `forward-native-messages.ts`. It:
- Extracted `normalizeThinking()` into a clean helper (good)
- Created an `OPTIONAL_FIELDS` allowlist array (good)
- **Reverted both our fixes** — stop_sequences sanitization and effort mapping were gone

## Recovery Timeline

| Step | Time | What happened |
|------|------|--------------|
| Discover | ~30s | `tpatch explore` forced us to re-read the file, immediately caught the revert |
| Assess | ~1 min | Understood the new code structure (helper + array pattern) |
| Re-implement | ~2 min | Adapted our fixes to the new structure instead of reverting the refactor |
| Verify | ~1 min | TSC + 67 tests + lint all green |
| Record | ~30s | `tpatch record` captured the final state |

**Total recovery: ~5 minutes.** Without tpatch's phase structure, we might not have caught the revert at all until a user hit the 400 error in production.

## What tpatch Actually Is

### It's not a git wrapper

Git tracks *what changed*. tpatch tracks *why it changed and what it's supposed to do*. The distinction matters:

- **Git** knows that `forward-native-messages.ts` was modified in commit `abc123`.
- **tpatch** knows that the modification was part of `native-payload-sanitization`, which exists because Buddy sends `stop_sequences: ['\n']` and Copilot rejects it, and that the fix must strip whitespace-only entries before forwarding.

When the parallel agent refactored the file, git saw "file changed." tpatch's `exploration.md` told us "these specific behaviors must be preserved," which is how we caught the regression.

### It's not just "keep your forks up to date"

Fork maintenance is one use case, but what we experienced today is closer to **intent preservation across chaotic development**. The chaos wasn't upstream — it was a parallel agent in our own repo. tpatch's value was:

1. **Spec as contract** — The acceptance criteria in `spec.md` gave us a checklist to verify after recovery. "Does `stop_sequences: ['\n']` still get stripped? Does `effort: 'low'` still disable thinking?" Without this, we'd be guessing.

2. **Exploration as ground truth** — When the code changed under us, `exploration.md` told us exactly where to look and what symbols mattered. We didn't have to re-discover the codebase.

3. **Phase gates prevent drift** — We couldn't skip from "I think this is done" to "ship it." Each phase forced a checkpoint. The explore phase is what caught the revert.

### Where tpatch shines vs. where it's overhead

**Shines:**
- Multi-agent environments (exactly our scenario — agents stepping on each other)
- Long-lived forks where features must survive upstream churn
- Features that span multiple files with non-obvious interdependencies
- Onboarding — a new contributor can read `spec.md` + `exploration.md` and understand *why* the code looks the way it does

**Overhead:**
- Simple one-file changes (a 3-line bug fix doesn't need 6 phases)
- Throwaway prototypes
- The recipe JSON is awkward for hand-authoring — the `--mode started/done` escape hatch is what makes Path B practical

## Product Positioning

### "Git with intent" — close, but undersells it

"Git with intent" captures the idea that tpatch adds *why* to git's *what*, but it sounds like a git plugin. tpatch is more opinionated than that — it imposes a methodology (analyze → define → explore → implement → apply → record → reconcile) that git doesn't care about.

### "Keep your forks up to date" — accurate but narrow

This is the reconcile phase. It's maybe 15% of the value. The other 85% is the structured thinking that happens *before* reconcile — the specs, explorations, and recorded patches that make reconcile possible.

### What it actually is

**tpatch is a feature-intent tracker for codebases maintained by multiple agents (human or AI).**

It answers the question: "When someone else changes code that my feature depends on, how do I know what broke and how to fix it?"

The methodology works because:
- **Specs** define what "correct" means, independent of implementation
- **Explorations** pin the spec to real code, so you know where to look when things change
- **Recipes** make changes reproducible (though the `--mode started/done` path is more practical for agent-authored changes)
- **Patches** capture intent as diffs, so reconcile can 3-way merge against new upstream
- **Reconcile** is the payoff — but only works because all the earlier phases built the context

### Suggested positioning

> **Tessera Patch: structured feature tracking for AI-assisted codebases.**
> When multiple agents and humans edit the same code, tpatch ensures every change has a spec, every spec has a patch, and every patch can be reconciled — automatically.

This positions it for the world we're actually in: not just fork maintenance, but **collaborative AI development** where agents routinely overwrite each other's work and nobody reads the git log.

## Metrics From This Session

- **8 features tracked** across the project
- **67 tests** produced with full lint/type compliance
- **1 revert recovered** in ~5 minutes thanks to exploration artifacts
- **0 manual git operations** needed for tpatch state management
- **Phase completion rate:** 100% (both features went requested → applied in one session)

## Honest Critique

1. **The recipe JSON is a tax.** We had to write dummy recipes just to advance state. The `--manual` path should accept "code already applied, skip recipe" without needing a file.
2. **Explore isn't enforced.** We could have skipped it and missed the revert. Consider making explore mandatory before implement, not just optional.
3. **Record captures too broadly.** Both features recorded the same 15KB patch because all changes were uncommitted. Feature-scoped recording would be cleaner.
4. **No agent collision detection.** tpatch didn't warn us that another agent modified a file tracked by our feature. A file-watch or pre-commit hook integration would catch this automatically.
