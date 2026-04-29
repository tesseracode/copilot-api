# Feature Request: Stabilise streaming chunk identity. In src/services/copilot/create-responses.ts makeChunk currently falls back to a fresh chatcmpl-randomUUID() every chunk when streamState.responseId is empty, and recomputes 'created' via Date.now() on every chunk. Generate the fallback id once per stream (cache on streamState) and freeze 'created' at stream start so all chunks of one response share id and created timestamp. Add a unit test that consumes a synthetic /responses stream where response.created arrives late and asserts every emitted chunk carries the same id and created value.

**Slug**: `responses-stream-stable-ids-and-created`
**Created**: 2026-04-29T22:10:08Z

## Description

Stabilise streaming chunk identity. In src/services/copilot/create-responses.ts makeChunk currently falls back to a fresh chatcmpl-randomUUID() every chunk when streamState.responseId is empty, and recomputes 'created' via Date.now() on every chunk. Generate the fallback id once per stream (cache on streamState) and freeze 'created' at stream start so all chunks of one response share id and created timestamp. Add a unit test that consumes a synthetic /responses stream where response.created arrives late and asserts every emitted chunk carries the same id and created value.
