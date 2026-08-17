# Analysis

## Confirmed defect

A synthetic run of `delta('{"a"')` → `output_item.added` → `delta(':1}')` → `done('{"a":1}')` through `translateResponsesStreamEvent` makes the client assemble `":1}"` rather than `{"a":1}`. The first delta is dropped because `getOrCreateToolCall` requires both `callId` and `name` and returns `undefined` without them, and the `done` event cannot repair the loss: `syncToolArguments` finds that `'{"a":1}'.startsWith('":1}')` is false, so the argument-divergence guard fires and deliberately preserves the broken prefix. The result is invalid JSON delivered as tool arguments, so the tool call fails.

## Trigger likelihood

A live capture on `gpt-5.3-codex` with `tool_choice: required` produced 14 deltas with zero ordering violations, so Copilot honours the OpenAI ordering today and this defect is latent. Two facts stop that from being reassuring. The deltas carry neither `name` nor `call_id` and identify their tool call *solely* by `output_index`, so if the ordering ever changed, tool-call creation would be impossible rather than merely lossy. And the ordering is a property of an upstream service this proxy does not control, which is exactly the class of assumption the catalog work has already shown to drift.

## Risk of the obvious fix, and why it is rejected

The entry's suggested fix — relax `getOrCreateToolCall` to create from `outputIndex` alone with a deferred or placeholder `name` — is **not safe**. The Anthropic consumer in `src/routes/messages/stream-translation.ts:151` opens a `content_block_start` only when a chunk carries both `toolCall.id` and `toolCall.function.name`. A chunk emitted without them would open no block, and the subsequent argument deltas would then hit the `if (toolCallInfo)` guard at line 184 and be discarded silently. That converts a latent OpenAI-path bug into an active Anthropic-path bug, and it would fire on the normal ordering path rather than only on the race.

Relaxing the divergence guard is equally unattractive. That guard exists precisely because `syncToolArguments` used to emit the full `nextArguments` on divergence, duplicating content already sent and producing invalid JSON. Weakening it to let `done` repair a missed prefix would reintroduce the duplication it was written to prevent.

## Chosen design and why its risk is low

Buffer orphan deltas by `output_index` on the stream state, emit nothing for them, and fold the buffered text into the tool call when `output_item.added` creates it. This is materially safer than the alternatives for three reasons.

The normal path is untouched. The buffer is only written when a delta resolves to no tool call, which never happens when `added` precedes the deltas, so in every stream observed today the new code is inert and emits nothing different.

Tool-call creation still happens only where `call_id` and `name` are known, so every emitted chunk continues to satisfy the Anthropic consumer's `id`-and-`name` contract and the OpenAI first-chunk convention.

The divergence guard is not modified and stops mis-firing on its own. After a flush, the accumulator holds the true streamed prefix, so `done` sees `startsWith` succeed, `missingArguments` is empty, and no warning or corruption occurs.

The residual risks are narrow and testable: a buffer must never be applied twice, and it must not leak into a later item that reuses the same `output_index`. Both are handled by clearing the entry when it is consumed and by discarding any stale entry when an item completes. A `done`-only completion path is also already safe, because `handleOutputItemDoneEvent` creates the tool call from `item.arguments`, which is complete.

## Verdict

Low risk, high reward: the change is inert under current upstream behavior, removes a silent-corruption failure mode, and is fully exercisable with synthetic events. Proceed with implementation.
