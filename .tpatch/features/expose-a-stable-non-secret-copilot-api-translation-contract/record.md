# Implementation Record: expose-a-stable-non-secret-copilot-api-translation-contract

**Recorded**: 2026-08-14T03:03:52Z
**Files changed**: 8
**Patch size**: 18689 bytes
**Capture mode**: working-tree-all
**Pathspecs**: src/lib/build-info.ts,src/lib/build-info.test.ts,src/lib/state.ts,src/lib/utils.ts,src/routes/models/route.ts,tests/operational-hardening.test.ts,Dockerfile,README.md

## Change Summary

```
 Dockerfile                          |   3 +
 README.md                           |  44 ++++++++++++
 src/lib/state.ts                    |   4 ++
 src/lib/utils.ts                    |   3 +
 src/routes/models/route.ts          |  15 ++++
 tests/operational-hardening.test.ts | 135 +++++++++++++++++++++++++++++++++++-
 6 files changed, 203 insertions(+), 1 deletion(-)
```

## Capture Provenance

- **capture_mode**: `working-tree-all`
- **pathspecs**: src/lib/build-info.ts, src/lib/build-info.test.ts, src/lib/state.ts, src/lib/utils.ts, src/routes/models/route.ts, tests/operational-hardening.test.ts, Dockerfile, README.md
- **claim_ids**: (none)
- **base_commit**: `c9e35aa50e3b8c0ea4a4748326ad956d1c3dda2f`
- **upper_commit**: `working-tree`

## Replay Instructions

To re-apply this feature to a clean checkout:

```bash
# From the feature's artifacts directory:
git apply .tpatch/features/expose-a-stable-non-secret-copilot-api-translation-contract/artifacts/post-apply.patch
```

