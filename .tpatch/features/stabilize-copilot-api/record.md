# Implementation Record: stabilize-copilot-api

**Recorded**: 2026-07-24T21:23:56Z
**Files changed**: 10
**Patch size**: 33097 bytes
**Capture mode**: committed-range
**Base commit**: 20461a2
**Upper bound**: HEAD

## Change Summary

```
 .../artifacts/apply-recipe.json                    | 65 +---------------------
 .../artifacts/patch-generations.json               | 36 +++++++++++-
 .../artifacts/post-apply-diff.txt                  | 15 ++---
 .../artifacts/post-apply.patch                     |  9 ++-
 .tpatch/features/stabilize-copilot-api/record.md   | 23 +++-----
 .tpatch/features/stabilize-copilot-api/status.json |  4 +-
 6 files changed, 55 insertions(+), 97 deletions(-)
```

## Capture Provenance

- **capture_mode**: `committed-range`
- **pathspecs**: (none)
- **claim_ids**: (none)
- **base_commit**: `20461a2`
- **upper_commit**: `HEAD`

## Replay Instructions

To re-apply this feature to a clean checkout:

```bash
# From the feature's artifacts directory:
git apply .tpatch/features/stabilize-copilot-api/artifacts/post-apply.patch
```

*Patch was captured as a committed diff from `20461a2` to `HEAD`.*
