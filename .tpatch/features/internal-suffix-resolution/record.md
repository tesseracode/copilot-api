# Implementation Record: internal-suffix-resolution

**Recorded**: 2026-04-29T05:11:28Z
**Files changed**: 11
**Patch size**: 40771 bytes

## Change Summary

```
 .../artifacts/apply-recipe.json                    |   9 +-
 .../artifacts/post-apply-diff.txt                  |   4 +-
 .../effort-model-suffix/artifacts/post-apply.patch | 324 ++++++-
 .tpatch/features/effort-model-suffix/record.md     |  10 +-
 .tpatch/features/effort-model-suffix/status.json   |   4 +-
 .../artifacts/post-apply.patch                     | 976 ++++++++++++++++++---
 6 files changed, 1195 insertions(+), 132 deletions(-)
```

## Replay Instructions

To re-apply this feature to a clean checkout:

```bash
# From the feature's artifacts directory:
git apply .tpatch/features/internal-suffix-resolution/artifacts/post-apply.patch
```

*Patch was captured as a committed diff from `497b222` to `HEAD`.*
