# Implementation Record: refuse-ambiguous-derived-pricing-model-ids-instead-of

**Recorded**: 2026-09-09T20:59:17Z
**Files changed**: 3
**Patch size**: 5292 bytes
**Capture mode**: working-tree-all
**Pathspecs**: src/lib/copilot-pricing.ts,tests/copilot-pricing.test.ts,tests/process-lifetime.test.ts

## Change Summary

```
 src/lib/copilot-pricing.ts     | 23 +++++++++++++--
 tests/copilot-pricing.test.ts  | 66 ++++++++++++++++++++++++++++++++++++++++++
 tests/process-lifetime.test.ts |  6 ++--
 3 files changed, 91 insertions(+), 4 deletions(-)
```

## Capture Provenance

- **capture_mode**: `working-tree-all`
- **pathspecs**: src/lib/copilot-pricing.ts, tests/copilot-pricing.test.ts, tests/process-lifetime.test.ts
- **claim_ids**: (none)
- **base_commit**: `a4afb6dc0772222ff88eec576bc366854080b24a`
- **upper_commit**: `working-tree`

## Replay Instructions

To re-apply this feature to a clean checkout:

```bash
# From the feature's artifacts directory:
git apply .tpatch/features/refuse-ambiguous-derived-pricing-model-ids-instead-of/artifacts/post-apply.patch
```

