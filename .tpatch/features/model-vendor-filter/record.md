# Implementation Record: model-vendor-filter

**Recorded**: 2026-04-27T02:05:54Z
**Files changed**: 8
**Patch size**: 14793 bytes

## Change Summary

```
 .tpatch/FEATURES.md                                 |  6 ++++--
 .tpatch/features/hide-internal-models/status.json   | 13 ++++++++-----
 .tpatch/features/log-model-display-name/status.json | 13 ++++++++-----
 src/routes/messages/anthropic-types.ts              |  4 ++++
 4 files changed, 24 insertions(+), 12 deletions(-)
```

## Replay Instructions

To re-apply this feature to a clean checkout:

```bash
# From the feature's artifacts directory:
git apply .tpatch/features/model-vendor-filter/artifacts/post-apply.patch
```

*Patch was captured as a committed diff from `643762993f47cb9b058b1c89627ba9a641139355` to `HEAD`.*
