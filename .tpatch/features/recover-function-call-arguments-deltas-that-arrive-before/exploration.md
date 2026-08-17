# Exploration

- `src/services/copilot/create-responses.ts:326-338` (`ResponsesStreamState`, `createResponsesStreamState`): where the orphan buffer must live so it is per-stream rather than module-global.
- `src/services/copilot/create-responses.ts:491` (`getOrCreateToolCall`): the `if (!callId || !name) return undefined` guard that drops the delta; deliberately left intact so creation still requires both fields.
- `src/services/copilot/create-responses.ts:619` (`handleFunctionCallArgumentsDeltaEvent`): the drop site — the `if (!toolCall) return` branch becomes the buffer write.
- `src/services/copilot/create-responses.ts:598` (`handleOutputItemAddedEvent`): the flush site, where `call_id` and `name` first exist and the first chunk is emitted.
- `src/services/copilot/create-responses.ts:478` (`getExistingToolCall`): resolves by `output_index` first, which is what makes `output_index` the correct buffer key given live deltas carry no `call_id`.
- `src/services/copilot/create-responses.ts:545-563` (`syncToolArguments`): the divergence guard that currently blocks recovery; not modified, and expected to stop firing once the prefix is correct.
- `src/services/copilot/create-responses.ts:659` (`handleOutputItemDoneEvent`, `getExistingOrCreateCompletedToolCall`): completes from full `item.arguments`, so it must discard rather than apply a stale buffer.
- `src/routes/messages/stream-translation.ts:151,184`: the Anthropic consumer requires `id` and `function.name` to open a block and silently discards argument deltas when no block was opened — the constraint that rules out emitting a nameless tool call.
- `tests/responses-stream-arg-divergence-guard.test.ts`: existing harness pattern (`runStream`, `createResponsesStreamState`) and the guard behavior that must not regress.
- Measured evidence: synthetic race assembles `":1}"` instead of `{"a":1}`; live `gpt-5.3-codex` capture shows 14 deltas, zero ordering violations, and deltas carrying neither `name` nor `call_id`.
- Out of scope: changing the divergence guard, relaxing the `call_id`/`name` requirement for creation, and entry 2's `output_index` namespacing across item types.
