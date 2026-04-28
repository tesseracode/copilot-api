# Case Study: `tpatch record` scoping limitations in Path B workflows

**Date**: 2026-04-28
**Context**: Recording 3 model-resolution features that landed in 2 commits

---

## Situation

We implemented three features during a single session and committed them as they were ready:

| Feature | Commit | Files touched |
|---------|--------|---------------|
| `per-generation-thinking` | `f831904` | `forward-native-messages.ts` |
| `internal-suffix-resolution` | `f6e9076` | `model-mapping.ts`, `model-mapping.test.ts` |
| `anthropic-beta-1m-detection` | `f6e9076` | `handler.ts`, `forward-native-messages.ts` |

Features 2 and 3 share a commit. Features 1 and 3 share a file (`forward-native-messages.ts`).

When we went to `tpatch record` each feature separately, we hit a scoping limitation.

## What we tried

### 1. Naive `--from` (identical patches)

```bash
tpatch record per-generation-thinking --from 497b222
tpatch record internal-suffix-resolution --from 497b222
tpatch record anthropic-beta-1m-detection --from 497b222
```

All three produced identical 15,914-byte patches covering all 4 files. Each feature's patch contains changes from the other two features.

### 2. `--from` + `--files` (incompatible)

```bash
tpatch record per-generation-thinking \
  --from 497b222 --files "src/services/copilot/forward-native-messages.ts"
```

**Result**: `error: --files is incompatible with --from`

### 3. `--from` + `--to` (flag doesn't exist)

```bash
tpatch record per-generation-thinking --from 497b222 --to f831904
```

**Result**: `error: unknown flag: --to`

### 4. Narrowing `--from` to parent of specific commit

```bash
tpatch record per-generation-thinking --from f831904~1
```

`f831904~1` resolves to `497b222`, so this is `497b222..HEAD` — captures everything, not just `f831904`. Same result as attempt 1.

## What we accepted

All three features recorded the same full diff from `497b222..HEAD`. The patches are valid and round-trip clean — they just contain extra files from sibling features. We regenerated recipes with `--regenerate-recipe` so at least the recipe reflects the actual patch content.

## Root cause

`tpatch record --from` always diffs `base..HEAD` across all files. There's no way to:

| Approach | Status |
|----------|--------|
| `--from X --files path1,path2` | Flags incompatible |
| `--from X --to Y` | `--to` doesn't exist |
| `--from X --to Y --files path1` | Would be ideal |

The underlying git primitive supports this trivially: `git diff <from>..<to> -- <pathspec>...`

## Suggested fix for tpatch

Allow `--files` with `--from`, and add `--to`:

```bash
tpatch record per-generation-thinking \
  --from 497b222 --to f831904 \
  --files "src/services/copilot/forward-native-messages.ts"

tpatch record internal-suffix-resolution \
  --from f831904 --to f6e9076 \
  --files "src/lib/model-mapping.ts,src/lib/model-mapping.test.ts"

tpatch record anthropic-beta-1m-detection \
  --from f831904 --to f6e9076 \
  --files "src/routes/messages/handler.ts,src/services/copilot/forward-native-messages.ts"
```

## Workaround we didn't try

Interactive rebase to split `f6e9076` into two commits (one per feature) would have worked. We chose not to — restructuring git history to fit tpatch's constraints felt backwards. The tool should adapt to how code naturally lands.

## Impact

Low for now — the patches are functionally correct, just over-inclusive. During reconciliation, the extra files will produce false-positive conflicts that need manual triage. For a fork with 3 features this is manageable. For a fork with 30 features sharing files across overlapping commits, it would be a real problem.
