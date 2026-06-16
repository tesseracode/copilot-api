# Implementation Record: api-context-effort-migration

**Recorded**: 2026-06-16T19:38:35Z
**Files changed**: 6
**Patch size**: 23260 bytes
**Capture mode**: working-tree-all

## Change Summary

```
 .tpatch/FEATURES.md                                |  1 +
 src/lib/model-mapping.test.ts                      | 74 ++++++++---------
 src/lib/model-mapping.ts                           | 85 +++++++++----------
 src/routes/messages/handler.ts                     |  9 ++-
 src/services/copilot/create-responses.ts           | 10 ++-
 .../copilot/forward-native-messages.test.ts        | 94 +++++++++++++++-------
 src/services/copilot/forward-native-messages.ts    | 72 +++++------------
 7 files changed, 174 insertions(+), 171 deletions(-)
```

## Capture Provenance

- **capture_mode**: `working-tree-all`
- **pathspecs**: (none)
- **claim_ids**: (none)
- **base_commit**: `caf072b2ce828eb5187d550ddaefb81e615fd9b2`
- **upper_commit**: `working-tree`

## Replay Instructions

To re-apply this feature to a clean checkout:

```bash
# From the feature's artifacts directory:
git apply .tpatch/features/api-context-effort-migration/artifacts/post-apply.patch
```

