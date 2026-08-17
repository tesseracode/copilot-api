# Implementation Record: stop-injecting-max-tokens-when-the-client-already-supplied

**Recorded**: 2026-08-17T08:44:32Z
**Files changed**: 3
**Patch size**: 5979 bytes
**Capture mode**: working-tree-all
**Pathspecs**: src/routes/chat-completions/handler.ts,src/services/copilot/create-chat-completions.ts,tests/chat-token-limit-injection.test.ts

## Change Summary

```
 src/routes/chat-completions/handler.ts          | 7 ++++++-
 src/services/copilot/create-chat-completions.ts | 5 +++++
 2 files changed, 11 insertions(+), 1 deletion(-)
```

## Capture Provenance

- **capture_mode**: `working-tree-all`
- **pathspecs**: src/routes/chat-completions/handler.ts, src/services/copilot/create-chat-completions.ts, tests/chat-token-limit-injection.test.ts
- **claim_ids**: (none)
- **base_commit**: `8552825973e6238c0f0b4d95cef4e26e48c487bb`
- **upper_commit**: `working-tree`

## Replay Instructions

To re-apply this feature to a clean checkout:

```bash
# From the feature's artifacts directory:
git apply .tpatch/features/stop-injecting-max-tokens-when-the-client-already-supplied/artifacts/post-apply.patch
```

