# Implementation Record: internal-suffix-resolution

**Recorded**: 2026-04-28T06:50:41Z
**Files changed**: 4
**Patch size**: 15914 bytes

## Change Summary

```
 .../artifacts/apply-recipe.json                    | 34 +++++++++++++++++++++-
 .../artifacts/post-apply-diff.txt                  | 11 +++----
 .../artifacts/recipe-stale.json                    |  5 ----
 .tpatch/features/per-generation-thinking/record.md | 13 +++++----
 .../features/per-generation-thinking/status.json   |  4 +--
 src/routes/messages/anthropic-types.ts             |  4 +++
 6 files changed, 52 insertions(+), 19 deletions(-)
```

## Replay Instructions

To re-apply this feature to a clean checkout:

```bash
# From the feature's artifacts directory:
git apply .tpatch/features/internal-suffix-resolution/artifacts/post-apply.patch
```

*Patch was captured as a committed diff from `497b222` to `HEAD`.*
