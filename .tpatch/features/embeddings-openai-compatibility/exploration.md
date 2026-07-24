# Exploration

- `src/routes/embeddings/route.ts`: currently trusts typed JSON and uses generic error forwarding.
- `src/services/copilot/create-embeddings.ts`: request types omit dimensions/encoding and no signal is forwarded.
- `state.models` exposes `max_inputs` and `supports.dimensions` for validation.
- `src/lib/error.ts` shows existing error forwarding, but embeddings needs a stable OpenAI boundary schema.
- Add dedicated route/service tests and live curl evidence.
