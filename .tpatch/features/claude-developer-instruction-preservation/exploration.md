# Exploration

- `src/routes/chat-completions/handler.ts`: Claude models currently use upstream Chat passthrough; no Chat→Anthropic conversion occurs.
- `src/routes/messages/non-stream-translation.ts`: `openaiToAnthropicPayload` has no production caller and its last-write system behavior is not the live route.
- `src/services/copilot/create-chat-completions.ts`: forwards original system/developer roles upstream.
- Live probes across three Claude generations disproved the filed premise.
- Native Messages controls use top-level system blocks and are not role-equivalent to Chat developer messages.

No implementation insertion point is warranted at current HEAD.
