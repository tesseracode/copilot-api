# Implementation Record: startup-model-count

**Recorded**: 2026-04-27T02:05:54Z
**Files changed**: 8
**Patch size**: 14793 bytes

## Change Summary

```
 .tpatch/FEATURES.md                                 |  8 +++++---
 .tpatch/features/hide-internal-models/status.json   | 13 ++++++++-----
 .tpatch/features/log-model-display-name/status.json | 13 ++++++++-----
 .tpatch/features/model-vendor-filter/status.json    | 13 ++++++++-----
 src/routes/messages/anthropic-types.ts              |  4 ++++
 5 files changed, 33 insertions(+), 18 deletions(-)
```

## Replay Instructions

To re-apply this feature to a clean checkout:

```bash
# From the feature's artifacts directory:
git apply .tpatch/features/startup-model-count/artifacts/post-apply.patch
```

*Patch was captured as a committed diff from `643762993f47cb9b058b1c89627ba9a641139355` to `HEAD`.*
