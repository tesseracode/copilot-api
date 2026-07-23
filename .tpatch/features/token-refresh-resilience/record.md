# Implementation Record: token-refresh-resilience

**Recorded**: 2026-07-21T13:54:07Z
**Files changed**: 9
**Patch size**: 20197 bytes
**Capture mode**: working-tree-all
**Pathspecs**: src/lib/token.ts,src/lib/copilot-fetch.ts,src/services/github/get-copilot-token.ts,src/services/copilot/create-responses.ts,src/services/copilot/create-chat-completions.ts,src/services/copilot/forward-native-messages.ts,src/services/copilot/create-embeddings.ts,src/services/copilot/get-models.ts,tests/copilot-fetch-refresh.test.ts

## Change Summary

```
 src/lib/token.ts                                | 97 ++++++++++++++++++-------
 src/services/copilot/create-chat-completions.ts | 27 ++++---
 src/services/copilot/create-embeddings.ts       |  6 +-
 src/services/copilot/create-responses.ts        | 20 +++--
 src/services/copilot/forward-native-messages.ts | 31 +++++---
 src/services/copilot/get-models.ts              | 10 ++-
 src/services/github/get-copilot-token.ts        |  5 +-
 7 files changed, 130 insertions(+), 66 deletions(-)
```

## Capture Provenance

- **capture_mode**: `working-tree-all`
- **pathspecs**: src/lib/token.ts, src/lib/copilot-fetch.ts, src/services/github/get-copilot-token.ts, src/services/copilot/create-responses.ts, src/services/copilot/create-chat-completions.ts, src/services/copilot/forward-native-messages.ts, src/services/copilot/create-embeddings.ts, src/services/copilot/get-models.ts, tests/copilot-fetch-refresh.test.ts
- **claim_ids**: (none)
- **base_commit**: `6f391928ccd259a91b8609dd9e17cc8215a6c4da`
- **upper_commit**: `working-tree`

## Replay Instructions

To re-apply this feature to a clean checkout:

```bash
# From the feature's artifacts directory:
git apply .tpatch/features/token-refresh-resilience/artifacts/post-apply.patch
```

