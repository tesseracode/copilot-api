# Implementation Record: responses-instruction-role-preservation

**Recorded**: 2026-07-30T04:50:49Z
**Files changed**: 2
**Patch size**: 4808 bytes
**Capture mode**: working-tree-all
**Pathspecs**: src/services/copilot/create-responses.ts,tests/responses-instruction-role-preservation.test.ts,.tpatch/POTENTIAL_FEATURES.md

## Change Summary

```
 .tpatch/POTENTIAL_FEATURES.md            | 8 +++-----
 src/services/copilot/create-responses.ts | 4 ++--
 2 files changed, 5 insertions(+), 7 deletions(-)
```

## Capture Provenance

- **capture_mode**: `working-tree-all`
- **pathspecs**: src/services/copilot/create-responses.ts, tests/responses-instruction-role-preservation.test.ts, .tpatch/POTENTIAL_FEATURES.md
- **claim_ids**: (none)
- **base_commit**: `925cf6214b0a7d22e79c6bf4c311852b79d40ba9`
- **upper_commit**: `working-tree`

## Replay Instructions

To re-apply this feature to a clean checkout:

```bash
# From the feature's artifacts directory:
git apply .tpatch/features/responses-instruction-role-preservation/artifacts/post-apply.patch
```

