# Implementation Record: anthropic-beta-1m-detection

**Recorded**: 2026-04-28T06:50:41Z
**Files changed**: 4
**Patch size**: 15914 bytes

## Change Summary

```
 .../artifacts/apply-recipe.json                    | 34 +++++++++++++++++++++-
 .../artifacts/post-apply-diff.txt                  | 12 ++++----
 .../artifacts/recipe-stale.json                    |  5 ----
 .../features/internal-suffix-resolution/record.md  | 14 +++++----
 .../internal-suffix-resolution/status.json         |  4 +--
 .../artifacts/apply-recipe.json                    | 34 +++++++++++++++++++++-
 .../artifacts/post-apply-diff.txt                  | 11 +++----
 .../artifacts/recipe-stale.json                    |  5 ----
 .tpatch/features/per-generation-thinking/record.md | 13 +++++----
 .../features/per-generation-thinking/status.json   |  4 +--
 src/routes/messages/anthropic-types.ts             |  4 +++
 11 files changed, 102 insertions(+), 38 deletions(-)
```

## Replay Instructions

To re-apply this feature to a clean checkout:

```bash
# From the feature's artifacts directory:
git apply .tpatch/features/anthropic-beta-1m-detection/artifacts/post-apply.patch
```

*Patch was captured as a committed diff from `497b222` to `HEAD`.*
