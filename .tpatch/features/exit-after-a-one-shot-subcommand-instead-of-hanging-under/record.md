# Implementation Record: exit-after-a-one-shot-subcommand-instead-of-hanging-under

**Recorded**: 2026-09-08T02:13:57Z
**Files changed**: 4
**Patch size**: 4213 bytes
**Capture mode**: working-tree-all
**Pathspecs**: src/lib/process-lifetime.ts,src/main.ts,src/start.ts,tests/process-lifetime.test.ts

## Change Summary

```
 src/main.ts  | 7 +++++++
 src/start.ts | 2 ++
 2 files changed, 9 insertions(+)
```

## Capture Provenance

- **capture_mode**: `working-tree-all`
- **pathspecs**: src/lib/process-lifetime.ts, src/main.ts, src/start.ts, tests/process-lifetime.test.ts
- **claim_ids**: (none)
- **base_commit**: `e4addaed4401f763da64a7f409571ba052b77436`
- **upper_commit**: `working-tree`

## Replay Instructions

To re-apply this feature to a clean checkout:

```bash
# From the feature's artifacts directory:
git apply .tpatch/features/exit-after-a-one-shot-subcommand-instead-of-hanging-under/artifacts/post-apply.patch
```

