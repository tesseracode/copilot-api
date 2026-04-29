# Implementation Record: anthropic-beta-1m-detection

**Recorded**: 2026-04-29T05:11:28Z
**Files changed**: 11
**Patch size**: 40771 bytes

## Change Summary

```
 .../artifacts/post-apply.patch                     | 976 ++++++++++++++++++---
 .../artifacts/apply-recipe.json                    |   9 +-
 .../artifacts/post-apply-diff.txt                  |   4 +-
 .../effort-model-suffix/artifacts/post-apply.patch | 324 ++++++-
 .tpatch/features/effort-model-suffix/record.md     |  10 +-
 .tpatch/features/effort-model-suffix/status.json   |   4 +-
 .../artifacts/apply-recipe.json                    |  57 +-
 .../artifacts/post-apply-diff.txt                  |  14 +-
 .../artifacts/post-apply.patch                     | 976 ++++++++++++++++++---
 .../features/internal-suffix-resolution/record.md  |  20 +-
 .../internal-suffix-resolution/status.json         |   4 +-
 11 files changed, 2128 insertions(+), 270 deletions(-)
```

## Replay Instructions

To re-apply this feature to a clean checkout:

```bash
# From the feature's artifacts directory:
git apply .tpatch/features/anthropic-beta-1m-detection/artifacts/post-apply.patch
```

*Patch was captured as a committed diff from `497b222` to `HEAD`.*
