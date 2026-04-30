# Potential Features (Deferred)

Non-standard tracking file for issues identified during the streaming-stability review (April 2026) that were intentionally deferred from the 5-feature batch. Each entry sketches the issue, evidence we have today, and a possible fix to seed a future `tpatch add` if the issue becomes real.

> Status convention: `latent` = bug confirmed by code reading but not by runtime evidence; `theoretical` = could happen given current code shape but no observed trigger; `cleanup` = correctness/clarity refactor, not a bug fix.

---

## 1. delta-before-added race in `function_call_arguments`

- **Status**: latent
- **File**: `src/services/copilot/create-responses.ts` (`getOrCreateToolCall`, around line 472)
- **Issue**: `response.function_call_arguments.delta` carries `call_id` / `output_index` / `delta` but typically does **not** carry `name`. `getOrCreateToolCall` requires both `callId` AND `name` to materialise a new tool call, so if a delta arrives before `response.output_item.added` (which carries `name`), `getExistingToolCall` misses it, then `getOrCreateToolCall` returns `undefined`, and the delta is silently dropped. Today this depends on the OpenAI spec ordering (`output_item.added` precedes deltas); Copilot's proxy is assumed to honour it.
- **Possible solution**: relax `getOrCreateToolCall` to allow creation from `callId + outputIndex` alone, deferring `name` assignment until `output_item.added` lands; emit a "name unknown" placeholder if a downstream chunk needs it before the added event. Alternatively, buffer orphan deltas in `streamState.pendingByCallId` and flush them once `output_item.added` is seen.
- **Trigger to file**: any log line confirming a delta arrived without a corresponding tool call entry, or a Copilot proxy change that re-orders events.

---

## 2. `output_index` namespace collision across output item types

- **Status**: theoretical
- **File**: `src/services/copilot/create-responses.ts` (`toolCallsByOutputIndex` map)
- **Issue**: `toolCallsByOutputIndex` is keyed by `output_index`, but `output_index` is shared across **all** output item types (reasoning, message, function_call). If an `output_index` previously belonged to a non-tool item that was never registered as a tool call, current code is safe by omission. But if upstream ever reuses an index after replacing an item type (replay, edit, abort-and-retry), a `function_call_arguments.delta` could be misrouted to the wrong tool entry.
- **Possible solution**: namespace the map: `toolCallsByOutputIndex` becomes `Map<\`${outputType}:${outputIndex}\`, ResponsesStreamToolCall>`. Or maintain `toolCallsByCallId` as the only authoritative index and use `output_index` only for fallback resolution within a single output_item lifecycle.
- **Trigger to file**: any test or trace showing two different output items sharing an index in the same response, or a tool delta resolving to an unrelated tool call entry.

---

## 3. Fragile `isNonStreaming` discriminator

- **Status**: cleanup
- **Files**:
  - `src/routes/messages/handler.ts:155-157`
  - `src/routes/chat-completions/handler.ts:118-120`
- **Issue**: `isNonStreaming` distinguishes between an async iterator (streaming) and a plain `ChatCompletionResponse` (non-streaming) via `Object.hasOwn(response, "choices")`. Works because the iterator returned by `events()` doesn't expose a `choices` own-property. If a future `events()` implementation, a wrapped iterator, or an error-shaped response ever does, the type narrowing lies.
- **Possible solution**: change `createChatCompletions` / `createResponses` to return a discriminated union — e.g. `{ kind: "stream", stream } | { kind: "object", body }` — so the caller switches on a stable tag instead of duck-typing.
- **Trigger to file**: a `events()` upgrade, a TypeScript flag tightening, or any incident where a streaming response was misidentified as non-streaming or vice versa.

---

## 4. Incremental `usage` emission is dropped

- **Status**: latent (minor)
- **File**: `src/services/copilot/create-responses.ts` (`handleCompletedEvent`, around line 692)
- **Issue**: `usage` is only translated and emitted on `response.completed`. If upstream begins sending interim `usage` data on other events (e.g. a future `response.output_item.done` carrying running token totals), the proxy drops it. Clients that update token-budget UIs from streaming `usage` would never see updates.
- **Possible solution**: read `data.response?.usage` on every event that carries it (`in_progress`, `output_item.done`, `incomplete`, `failed`) and emit a chunk with the latest usage when it changes. Track last-seen usage on `streamState.lastUsage` to avoid emitting redundant chunks.
- **Trigger to file**: a Copilot release note mentioning streaming usage, or a client request for live token counters during a stream.

---

## 5. `mapOpenAIStopReasonToAnthropic` maps `content_filter` → `end_turn`

- **Status**: cleanup / minor correctness
- **File**: `src/routes/messages/utils.ts`
- **Issue**: Anthropic does not have a `content_filter` stop reason, so the current mapping flattens it to `end_turn`. The Anthropic stream looks like a normal completion when the upstream actually rejected on a filter. Clients that distinguish "model declined" from "model finished" lose that signal. Surfaces during `responses-stream-error-events` `response.incomplete` with `reason: "content_filter"`.
- **Possible solution**: emit an Anthropic `error` event with `error.type: "permission_error"` (or similar) for `content_filter`, instead of a normal `message_delta + message_stop`. Or add a non-standard `stop_reason: "content_filter"` and document the divergence.
- **Trigger to file**: a real content-filter rejection observed in production, or a customer asking why filtered turns appear identical to clean completions.

---

## 6. `translateMessages` collapses `system` and `developer` into `developer`

- **Status**: cleanup / semantic loss
- **File**: `src/services/copilot/create-responses.ts` (`translateMessages`, around lines 81-90)
- **Issue**: Both `system` and `developer` roles in the OpenAI Chat Completions payload are emitted as `role: "developer"` on the /responses side. Functionally equivalent on Copilot today, but the system/developer distinction is meaningful in newer OpenAI runtimes (developer = always-on instructions vs. system = single-shot priming).
- **Possible solution**: pass `role` through verbatim if the /responses API recognises both. Verify against the upstream schema; if it only accepts `developer`, document the collapse with a comment instead of leaving it implicit.
- **Trigger to file**: a /responses schema update that distinguishes the roles, or a customer noticing system-vs-developer differences in behaviour.

---

## 7. `temperature` / `top_p` silently dropped for GPT-5.x

- **Status**: intentional, but worth re-evaluating
- **File**: `src/services/copilot/create-responses.ts` (`translateRequestToResponses`, lines 180-185, with the inline comment)
- **Issue**: `temperature` and `top_p` are intentionally omitted because the /responses API rejects them for GPT-5.x ("Unsupported parameter"). Clients that set these values get them silently dropped, which can produce "why is my temperature setting ignored?" confusion.
- **Possible solution**: emit a one-time `consola.warn` per request when `temperature` or `top_p` is provided but dropped, naming the model. Alternatively, surface a 400 if `temperature !== 1` or similar — but that's a behavioural break.
- **Trigger to file**: any user-facing report that temperature is ignored, or a Copilot upgrade that re-enables those params.

---

## How to use this file

When evidence for one of these flips from "could happen" to "happened in production" (a log line, a user report, a failing test, or a Copilot proxy change), promote it:

```bash
tpatch add --slug <slug> "<concise description copied from the entry>"
```

Then follow Path B (analyze / define / explore / implement / apply / record) like the 5 features in the April 2026 stability batch (`responses-stream-stable-ids-and-created`, `responses-stream-arg-divergence-guard`, `responses-stream-error-events`, `responses-stream-abort-propagation`, `messages-tool-result-validation`).

This file is **not** part of the standard tpatch workspace layout — it's a working backlog. Update or remove entries as they're filed, fixed, or invalidated by upstream changes.
