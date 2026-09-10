# Implementation Record: derive-model-identifiers-instead-of-enumerating-them-so-a

**Recorded**: 2026-09-08T01:00:25Z
**Files changed**: 4
**Patch size**: 11541 bytes
**Capture mode**: working-tree-all
**Pathspecs**: src/lib/model-mapping.ts,src/lib/model-mapping.test.ts,src/lib/copilot-pricing.ts,tests/copilot-pricing.test.ts

## Change Summary

```
 src/lib/copilot-pricing.ts    | 46 ++++++++++++++++-----------
 src/lib/model-mapping.test.ts | 54 +++++++++++++++++++++++++++++++
 src/lib/model-mapping.ts      | 21 ++++++++++--
 tests/copilot-pricing.test.ts | 74 +++++++++++++++++++++++++++++++++++++++++--
 4 files changed, 171 insertions(+), 24 deletions(-)
```

## Capture Provenance

- **capture_mode**: `working-tree-all`
- **pathspecs**: src/lib/model-mapping.ts, src/lib/model-mapping.test.ts, src/lib/copilot-pricing.ts, tests/copilot-pricing.test.ts
- **claim_ids**: (none)
- **base_commit**: `a9d7b4fc2799874d396bfa553b1d17fe74a6e4f4`
- **upper_commit**: `working-tree`

## Replay Instructions

To re-apply this feature to a clean checkout:

```bash
# From the feature's artifacts directory:
git apply .tpatch/features/derive-model-identifiers-instead-of-enumerating-them-so-a/artifacts/post-apply.patch
```

