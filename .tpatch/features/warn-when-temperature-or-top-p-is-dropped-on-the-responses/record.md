# Implementation Record: warn-when-temperature-or-top-p-is-dropped-on-the-responses

**Recorded**: 2026-08-18T04:22:54Z
**Files changed**: 3
**Patch size**: 6966 bytes
**Capture mode**: working-tree-all
**Pathspecs**: src/services/copilot/create-responses.ts,tests/responses-dropped-sampling-params.test.ts,README.md

## Change Summary

```
 README.md                                | 28 ++++++++++++++++++++++++++++
 src/services/copilot/create-responses.ts | 27 +++++++++++++++++++++++++++
 2 files changed, 55 insertions(+)
```

## Capture Provenance

- **capture_mode**: `working-tree-all`
- **pathspecs**: src/services/copilot/create-responses.ts, tests/responses-dropped-sampling-params.test.ts, README.md
- **claim_ids**: (none)
- **base_commit**: `5bf7700bf079a98088b9811cb1e8e8f87060a384`
- **upper_commit**: `working-tree`

## Replay Instructions

To re-apply this feature to a clean checkout:

```bash
# From the feature's artifacts directory:
git apply .tpatch/features/warn-when-temperature-or-top-p-is-dropped-on-the-responses/artifacts/post-apply.patch
```

