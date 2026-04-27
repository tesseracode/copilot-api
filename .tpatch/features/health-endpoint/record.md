# Implementation Record: health-endpoint

**Recorded**: 2026-04-27T02:05:54Z
**Files changed**: 8
**Patch size**: 14793 bytes

## Change Summary

```
 .tpatch/FEATURES.md                                 | 10 ++++++----
 .tpatch/features/hide-internal-models/status.json   | 13 ++++++++-----
 .tpatch/features/log-model-display-name/status.json | 13 ++++++++-----
 .tpatch/features/model-vendor-filter/status.json    | 13 ++++++++-----
 .tpatch/features/startup-model-count/status.json    | 13 ++++++++-----
 src/routes/messages/anthropic-types.ts              |  4 ++++
 6 files changed, 42 insertions(+), 24 deletions(-)
```

## Replay Instructions

To re-apply this feature to a clean checkout:

```bash
# From the feature's artifacts directory:
git apply .tpatch/features/health-endpoint/artifacts/post-apply.patch
```

*Patch was captured as a committed diff from `643762993f47cb9b058b1c89627ba9a641139355` to `HEAD`.*
