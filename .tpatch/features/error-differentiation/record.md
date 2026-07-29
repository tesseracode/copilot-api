# Implementation Record: error-differentiation

**Recorded**: 2026-07-29T05:24:27Z
**Files changed**: 4
**Patch size**: 19665 bytes
**Capture mode**: working-tree-all
**Pathspecs**: src/lib/error.ts,tests/non-stream-error-normalization.test.ts,tests/anthropic-error-envelope.test.ts,tests/messages-tool-result-validation.test.ts

## Change Summary

```
 src/lib/error.ts                              | 324 +++++++++++++++++---------
 tests/anthropic-error-envelope.test.ts        |   5 +-
 tests/messages-tool-result-validation.test.ts |  20 +-
 3 files changed, 238 insertions(+), 111 deletions(-)
```

## Capture Provenance

- **capture_mode**: `working-tree-all`
- **pathspecs**: src/lib/error.ts, tests/non-stream-error-normalization.test.ts, tests/anthropic-error-envelope.test.ts, tests/messages-tool-result-validation.test.ts
- **claim_ids**: (none)
- **base_commit**: `aa8601b65c43cfd64cfdd1c9eb35112ade0020bf`
- **upper_commit**: `working-tree`

## Replay Instructions

To re-apply this feature to a clean checkout:

```bash
# From the feature's artifacts directory:
git apply .tpatch/features/error-differentiation/artifacts/post-apply.patch
```

