# Implementation Record: tolerate-catalog-entries-that-omit-capabilities-limits-the

**Recorded**: 2026-09-08T00:59:58Z
**Files changed**: 7
**Patch size**: 8517 bytes
**Capture mode**: working-tree-all
**Pathspecs**: src/services/copilot/get-models.ts,src/routes/chat-completions/handler.ts,src/routes/embeddings/route.ts,scripts/lib/context-boundary.ts,scripts/context-boundary-validation.ts,scripts/lib/copilot-test-lib.ts,tests/catalog-shape-resilience.test.ts

## Change Summary

```
 scripts/context-boundary-validation.ts | 4 ++--
 scripts/lib/context-boundary.ts        | 6 +++---
 scripts/lib/copilot-test-lib.ts        | 2 +-
 src/routes/chat-completions/handler.ts | 2 +-
 src/routes/embeddings/route.ts         | 2 +-
 src/services/copilot/get-models.ts     | 9 ++++++++-
 6 files changed, 16 insertions(+), 9 deletions(-)
```

## Capture Provenance

- **capture_mode**: `working-tree-all`
- **pathspecs**: src/services/copilot/get-models.ts, src/routes/chat-completions/handler.ts, src/routes/embeddings/route.ts, scripts/lib/context-boundary.ts, scripts/context-boundary-validation.ts, scripts/lib/copilot-test-lib.ts, tests/catalog-shape-resilience.test.ts
- **claim_ids**: (none)
- **base_commit**: `67222dcc6c32e83da6f33bf424c9e9de84ed253e`
- **upper_commit**: `working-tree`

## Replay Instructions

To re-apply this feature to a clean checkout:

```bash
# From the feature's artifacts directory:
git apply .tpatch/features/tolerate-catalog-entries-that-omit-capabilities-limits-the/artifacts/post-apply.patch
```

