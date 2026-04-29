# Feature Request: Propagate client disconnects to upstream fetch calls so aborted SSE streams stop consuming Copilot quota. In src/routes/messages/handler.ts the streaming for-await loop never observes c.req.raw.signal, and src/services/copilot/{create-responses,create-chat-completions,forward-native-messages}.ts call fetch without an AbortSignal. Wire the request signal end-to-end (handler -> service -> fetch) and break the SSE consumer loop on abort. Add an integration test that asserts the upstream AbortSignal fires when the downstream consumer disconnects mid-stream.

**Slug**: `responses-stream-abort-propagation`
**Created**: 2026-04-29T22:10:06Z

## Description

Propagate client disconnects to upstream fetch calls so aborted SSE streams stop consuming Copilot quota. In src/routes/messages/handler.ts the streaming for-await loop never observes c.req.raw.signal, and src/services/copilot/{create-responses,create-chat-completions,forward-native-messages}.ts call fetch without an AbortSignal. Wire the request signal end-to-end (handler -> service -> fetch) and break the SSE consumer loop on abort. Add an integration test that asserts the upstream AbortSignal fires when the downstream consumer disconnects mid-stream.
