# Implementation Record: claude-chat-completions-passthrough

**Recorded**: 2026-07-25T17:12:40Z
**Files changed**: 2
**Patch size**: 14246 bytes
**Capture mode**: working-tree-all

## Change Summary

```
 .tpatch/FEATURES.md                                |  28 +++
 .../chat-completions-native-reroute/request.md     |   8 +
 src/routes/chat-completions/handler.ts             | 201 ---------------------
 3 files changed, 36 insertions(+), 201 deletions(-)
```

## Capture Provenance

- **capture_mode**: `working-tree-all`
- **pathspecs**: (none)
- **claim_ids**: (none)
- **base_commit**: `16f190276417c7710390f2b7119cfc10ccbe296d`
- **upper_commit**: `working-tree`

## Replay Instructions

To re-apply this feature to a clean checkout:

```bash
# From the feature's artifacts directory:
git apply .tpatch/features/claude-chat-completions-passthrough/artifacts/post-apply.patch
```

