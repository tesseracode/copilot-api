# Exploration

- `src/routes/chat-completions/handler.ts:50`: the single injection site — `if (isNullish(payload.max_tokens))` must also consider `max_completion_tokens`.
- `src/services/copilot/create-chat-completions.ts:45`: `body: JSON.stringify(payload)` forwards the entire object, which is why an unknown client field survives alongside the injected one.
- `src/services/copilot/create-chat-completions.ts:159`: `ChatCompletionsPayload` declares `max_tokens` but not `max_completion_tokens`; adding the optional field makes the guard type-safe.
- `src/lib/utils.ts`: `isNullish` is the existing helper for the null/undefined check and should stay the basis of the guard.
- `src/lib/endpoint-routing.ts`: confirms only non-Responses, non-native-Messages models reach this path, bounding the blast radius.
- `src/services/copilot/create-responses.ts:214`: maps `max_tokens` to `max_output_tokens` only when non-null and invents nothing, so the Responses path needs no change.
- `src/routes/messages/non-stream-translation.ts:501`: the `?? 4096` default applies to a field the Anthropic contract already requires, so it is out of scope.
- `tests/create-chat-completions.test.ts`: existing home for Chat payload assertions and the natural place for the four-combination matrix.
- Upstream evidence (`claude-opus-4.6`, live probe): only `max_tokens` 200, only `max_completion_tokens` 200, neither 200, both 400 `max_tokens and max_completion_tokens cannot both be set`.
- Out of scope: removing the catalog default entirely, changing Responses or Messages token handling, and any gateway-owned validation.
