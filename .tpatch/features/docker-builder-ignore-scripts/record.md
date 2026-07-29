# Implementation Record: docker-builder-ignore-scripts

**Recorded**: 2026-07-29T22:06:09Z
**Files changed**: 1
**Patch size**: 325 bytes
**Capture mode**: working-tree-all
**Pathspecs**: Dockerfile

## Change Summary

```
 Dockerfile | 2 +-
 1 file changed, 1 insertion(+), 1 deletion(-)
```

## Capture Provenance

- **capture_mode**: `working-tree-all`
- **pathspecs**: Dockerfile
- **claim_ids**: (none)
- **base_commit**: `33d81be3c38fe03c7cc8c282dd04c3cf3845197e`
- **upper_commit**: `working-tree`

## Replay Instructions

To re-apply this feature to a clean checkout:

```bash
# From the feature's artifacts directory:
git apply .tpatch/features/docker-builder-ignore-scripts/artifacts/post-apply.patch
```

