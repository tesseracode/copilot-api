# Implementation Record: hide-internal-models

**Recorded**: 2026-04-27T02:05:54Z
**Files changed**: 8
**Patch size**: 14793 bytes

## Change Summary

```
 .tpatch/FEATURES.md                               | 2 ++
 .tpatch/features/hide-internal-models/status.json | 6 +++---
 src/routes/messages/anthropic-types.ts            | 4 ++++
 3 files changed, 9 insertions(+), 3 deletions(-)
```

## Replay Instructions

To re-apply this feature to a clean checkout:

```bash
# From the feature's artifacts directory:
git apply .tpatch/features/hide-internal-models/artifacts/post-apply.patch
```

*Patch was captured as a committed diff from `abdefd7c2088160d3b66792f5517bc2a23a41cb2` to `HEAD`.*
