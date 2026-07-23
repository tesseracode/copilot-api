# Exploration

- `src/lib/token.ts`: fixed interval, stale-token state, and timer exception source.
- `src/services/github/get-copilot-token.ts`: provides `expires_at`, `refresh_in`, and IDE token.
- `src/lib/api-config.ts`: creates request authorization headers.
- `src/services/copilot/create-responses.ts`, `create-chat-completions.ts`, `create-embeddings.ts`, `get-models.ts`, and `forward-native-messages.ts`: authenticated fetch call sites.
- A shared `src/lib/copilot-fetch.ts` can refresh and replay one 401 without duplicating endpoint logic.
- Tests should inject token fetch/timers or fetch implementations to cover transient refresh failures, deduplication, 401 replay, and abort preservation.
