# Implementation Record: anthropic-error-envelope

**Recorded**: 2026-07-27T17:40:41Z
**Files changed**: 3
**Patch size**: 11928 bytes
**Capture mode**: working-tree-all

## Change Summary

```
 .tpatch/FEATURES.md          | 17 ++++++++
 .tpatch/RETROSPECTIVE.md     | 30 +++++++++++++-
 src/lib/error.ts             | 98 ++++++++++++++++++++++++++++++++++++++++++++
 src/routes/messages/route.ts |  6 +--
 4 files changed, 146 insertions(+), 5 deletions(-)
```

## Capture Provenance

- **capture_mode**: `working-tree-all`
- **pathspecs**: (none)
- **claim_ids**: (none)
- **base_commit**: `a3b0e119fcc5e7c90fc9b729ff19a36a993aa557`
- **upper_commit**: `working-tree`

## Replay Instructions

To re-apply this feature to a clean checkout:

```bash
# From the feature's artifacts directory:
git apply .tpatch/features/anthropic-error-envelope/artifacts/post-apply.patch
```

