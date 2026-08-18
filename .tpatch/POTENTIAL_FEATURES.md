# Potential Features (Deferred)

Non-standard tracking file for issues identified during the streaming-stability review (April 2026) that were intentionally deferred from the 5-feature batch. Each entry sketches the issue, evidence we have today, and a possible fix to seed a future `tpatch add` if the issue becomes real.

> Status convention: `latent` = bug confirmed by code reading but not by runtime evidence; `theoretical` = could happen given current code shape but no observed trigger; `cleanup` = correctness/clarity refactor, not a bug fix.

---

## 1. delta-before-added race in `function_call_arguments`

- **Status**: completed by `recover-function-call-arguments-deltas-that-arrive-before`.
- **Resolution**: orphan deltas are buffered by `output_index` on the stream state and folded into the tool call when `output_item.added` names it, so the racing order now assembles the provider's exact arguments. The buffer is cleared on use and discarded when an item completes, so it cannot double-apply or leak into a later item reusing the index.
- **Measured before the fix**: the racing order made the client assemble `":1}"` instead of `{"a":1}` — invalid JSON, so the tool call failed. The `done` event could not repair it, because `syncToolArguments` saw that the complete arguments did not start with the streamed prefix and the divergence guard deliberately preserved the broken prefix.
- **Why the entry's suggested fix was rejected**: relaxing `getOrCreateToolCall` to create from `outputIndex` alone would emit a tool call chunk without `id`/`name`, and the Anthropic consumer (`stream-translation.ts:151`) only opens a `content_block_start` when both are present — so subsequent argument deltas would hit the `if (toolCallInfo)` guard and be discarded. That would have turned a latent OpenAI-path bug into an active Anthropic-path bug on the *normal* ordering.
- **Historical note**: no live trigger was ever observed — a `gpt-5.3-codex` capture showed 14 deltas with zero ordering violations. The fix is inert under that ordering, and the accompanying tests were verified to fail against the unfixed assembler.

---

## 2. `output_index` namespace collision across output item types

- **Status**: **closed — premise disproved by measurement (2026-08-17)**. Do not implement namespacing.
- **File**: `src/services/copilot/create-responses.ts` (`toolCallsByOutputIndex` map)
- **Original concern**: `toolCallsByOutputIndex` is keyed by `output_index`, which is shared across all output item types, so if upstream ever reused an index "after replacing an item type (replay, edit, abort-and-retry)", a `function_call_arguments.delta` could be misrouted to the wrong tool entry.
- **Why the named triggers cannot cause it**: replay, edit, and abort-and-retry all begin a **new response stream**, and `createResponsesStreamState()` is invoked per request (`src/routes/chat-completions/handler.ts:140`, `src/routes/messages/handler.ts:252`). Every request therefore starts with an empty map, so no state survives to be collided with. A measured two-turn replay — full history plus `function_call_output` — restarted cleanly at `output_index` 0 with a fresh map on turn 2.
- **Within a single stream, indices are monotonic and unique.** Five scenarios on `gpt-5.4-mini` produced zero collisions and no index ever restarted or repeated: two parallel tool calls took indices 1 and 2, three tool calls took 1, 2 and 3, a text-then-tool response took 0 and 1, an output-budget-truncated response emitted a single item, and the replayed continuation behaved as above.
- **Safety is doubly guaranteed**: only `function_call` items are ever registered in the map, so a reasoning or message item at some index can never be mistaken for a tool call; and function calls receive unique monotonically increasing indices, so two of them cannot share one.
- **Residual note**: the map remains load-bearing, because deltas carry neither `name` nor `call_id` and identify their tool call solely by `output_index`. The same is true of the orphan buffer added by `recover-function-call-arguments-deltas-that-arrive-before`, which mitigates locally by discarding its entry when an item completes. Namespacing the key would add complexity without addressing any demonstrated failure.
- **Reopen only if**: a trace shows two `function_call` items sharing an `output_index` *within one response*, which is the only mechanism that could still produce the described misrouting.

---

## 3. Fragile `isNonStreaming` discriminator

- **Status**: completed by `streaming-response-discriminated-union`.
- **Resolution**: `createChatCompletions` and `createResponses` now return `{ kind: "stream", stream } | { kind: "object", body }`; all callers dispatch on the explicit tag and the `isNonStreaming` predicate was removed.
- **Historical note**: the predicate was improved from `choices` checking to `Symbol.asyncIterator` before removal, so no production incident occurred. Mutation tests now pin the explicit service contract and exhaustive caller handling.

---

## 4. Incremental `usage` emission is dropped

- **Status**: hypothetical — **do not implement speculatively (measured 2026-08-17)**
- **File**: `src/services/copilot/create-responses.ts` (`handleCompletedEvent`, `handleFailedEvent`, `handleIncompleteEvent`)
- **Correction to the original entry**: usage is **not** emitted only on `response.completed`. All three terminal handlers already translate it — `completed` (line 752), `failed` (781) and `incomplete` (814) — so `failed` and `incomplete` were never in the gap the entry described.
- **Measured upstream behavior (`gpt-5.4-mini`)**: usage arrives on exactly one terminal event per stream and never incrementally. A 79-delta text stream produced usage on `response.completed` alone (23 in / 99 out / 122 total) out of ~89 events; `response.in_progress` and `response.output_item.done` carried none. A stream truncated by `max_output_tokens` produced usage only on `response.incomplete` (16 / 20 / 36), which the proxy already forwards. **There is no interim usage to drop.**
- **The Anthropic path is fine too**: `src/routes/messages/stream-translation.ts:78,217` maps `prompt_tokens` minus cached tokens to `input_tokens`, `completion_tokens` to `output_tokens`, and preserves `cache_read_input_tokens`.
- **Exposure is translation-path only.** The native `/v1/responses` route re-emits upstream bytes unchanged — `wrapResponsesStream` inspects frames only to detect terminal errors, and `tests/native-responses-route.test.ts` asserts exact byte equality — so native consumers would receive interim usage automatically with no code change. Only the translating paths (`/v1/chat/completions`, and `/v1/messages` when routed through Responses) would drop it, because `translateResponsesStreamEvent` reads usage solely in the three terminal handlers.
- **Why implementing anyway would be harmful**: emitting usage on non-terminal chunks breaks the OpenAI convention that usage arrives in the final chunk. Clients that accumulate usage across chunks would double-count, so a speculative fix would create an active bug to guard a hypothetical one — the same trap as the rejected `getOrCreateToolCall` relaxation in entry 1.
- **Trigger to file**: a capture showing usage on a non-terminal event, a Copilot release note introducing streaming usage, or a client that genuinely needs live token counters mid-stream.

---

## 5. `mapOpenAIStopReasonToAnthropic` maps `content_filter` → `end_turn`

- **Status**: completed by `response-refusal-preservation`.
- **Resolution**: Responses refusal text is preserved in Chat `refusal` fields and Anthropic text blocks; Chat `content_filter` maps to Anthropic's standard `stop_reason: "refusal"`. Streaming refusal delta/done events are preserved exactly once, partial ordinary content keeps order, and non-stream incomplete/refusal responses no longer become empty normal success.
- **Historical note**: the original permission-error proposal was rejected after protocol research. Content filtering/refusal is model-output termination, not caller authorization failure.

---

## 6. `translateMessages` collapses `system` and `developer` into `developer`

- **Status**: completed by `responses-instruction-role-preservation`.
- **Resolution**: Chat-to-Responses translation now preserves `system` and `developer` role identity and order exactly. Live GPT-5.6 conflict probes showed order-based behavior; GPT-5 mini and Microsoft MAI accepted both roles. Chat-routed Gemini/legacy models bypass this translator.
- **Boundary note**: Claude Messages has top-level system instructions and no developer message role. Live probing found a separate Chat-to-Claude developer-instruction gap, tracked as `claude-developer-instruction-preservation` rather than hidden inside this Responses feature.

---

## 7. `temperature` / `top_p` silently dropped for GPT-5.x

- **Status**: intentional, but worth re-evaluating
- **File**: `src/services/copilot/create-responses.ts` (`translateRequestToResponses`, lines 180-185, with the inline comment)
- **Issue**: `temperature` and `top_p` are intentionally omitted because the /responses API rejects them for GPT-5.x ("Unsupported parameter"). Clients that set these values get them silently dropped, which can produce "why is my temperature setting ignored?" confusion.
- **Possible solution**: emit a one-time `consola.warn` per request when `temperature` or `top_p` is provided but dropped, naming the model. Alternatively, surface a 400 if `temperature !== 1` or similar — but that's a behavioural break.
- **Trigger to file**: any user-facing report that temperature is ignored, or a Copilot upgrade that re-enables those params.

---

## WebSocket Responses transport (`ws:/responses`)

- **Status**: measured, deliberately not implemented
- **File**: `src/lib/endpoint-routing.ts` (`resolveEndpoint`)
- **Measurement (2026-08-17, live catalog, 42 models)**: 8 models advertise `ws:/responses` — `gpt-5.3-codex`, `gpt-5.4-mini`, `gpt-5.4`, `gpt-5.5`, `gpt-5.6-luna`, `gpt-5.6-sol`, `gpt-5.6-terra`, `gpt-5-mini`. Endpoint form counts: `/chat/completions` 14, `/responses` 12, `ws:/responses` 8, `/v1/messages` 7.
- **Decisive fact**: every model advertising `ws:/responses` also advertises plain `/responses`. There is no ws-only model, so WebSocket support unlocks **zero** capability that HTTP does not already provide. It would be a latency/transport optimization only.
- **Current handling is already correct**: `resolveEndpoint` matches on `endpoints.includes("/responses")`, which is true for all 8 models, so the `ws:` entry is ignored harmlessly. No bug, no dead path.
- **Cost if implemented**: a second transport with connection lifecycle, reconnect/backoff, multiplexing, backpressure, and abort semantics — duplicating the SSE pipeline (`responses-stream-wrapper.ts`, `streaming.ts`) for no functional gain.
- **Trigger to file**: a model appears that advertises `ws:/responses` *without* `/responses`, or a measured latency/throughput problem attributable to SSE that a WebSocket would fix.

---

## `runServer` length vs the `max-lines-per-function` rule

- **Status**: cleanup — extract, do **not** relax the rule
- **File**: `src/start.ts` (`runServer`)
- **Issue**: `runServer` sits at 99 of the allowed 100 lines, so the next startup addition will fail lint. The rule comes from the shared `@echristian/eslint-config` and is configured `max: 100, skipBlankLines: true, skipComments: true` — the count is 99 lines of *real code*, not formatting.
- **Verdict — the rule is flagging a true positive.** `runServer` currently owns at least seven responsibilities: proxy/logging setup, option-to-state transfer, auth bootstrap, catalog and scheduler startup, 1M-context env detection, Claude Code interactive setup, and server listen plus dev SIGINT handling. **The `if (options.claudeCode)` block alone is 51 of the 99 lines — more than half the function.**
- **Why that block is the right extraction**: it is opt-in behind a CLI flag, it is *interactive* (two `consola.prompt` calls plus a clipboard write), and it is a completely different concern from starting an HTTP server. It is also untestable where it sits, because driving it would block on prompts. Extracting `setupClaudeCodeEnv(serverUrl)` drops `runServer` to roughly 48 lines, makes the Claude Code flow independently testable, and restores headroom for future startup wiring.
- **Why not relax the rule**: `max-lines-per-function` is inherited from an upstream shared config, so relaxing it means adding a local override to `eslint.config.js` — a fork customization that must be maintained across upstream bumps. Worse, the override is **global**: loosening the threshold to accommodate one function would mask genuine cases everywhere else in the codebase. The surrounding config is not unreasonably strict either (`max-lines` 800, `complexity` 16), so 100 is a normal threshold rather than an outlier worth fighting.
- **Risk**: low and bounded. The block is contiguous and self-contained — it reads `state.models` and `serverUrl` and writes `state.is1MContext`, all module-scoped — so the move is mechanical, and only `--claude-code` users are in the blast radius.
- **Trigger to file**: the next change that needs a line in `runServer`, or any work on the Claude Code onboarding flow.

---

## Unknown upstream events are silently dropped on the translating path

- **Status**: observability gap, not a bug — a debug log is the proportionate fix
- **File**: `src/services/copilot/create-responses.ts` (`translateResponsesStreamEvent`, `default: break`)
- **Asymmetry**: the native `/v1/responses` route re-emits upstream bytes unchanged, so it is inherently forward-compatible with any event Copilot invents. The translating paths (`/v1/chat/completions`, and `/v1/messages` routed through Responses) dispatch on a `switch` whose `default` branch discards anything unrecognised, with no log and no counter.
- **This is currently correct behavior.** A measured text stream (`gpt-5.4-mini`) emitted three event types that already fall through to `default` — `response.content_part.added`, `response.output_text.done` and `response.content_part.done` — all of which are structural markers carrying no content the OpenAI chunk format needs, because the text already arrived via `response.output_text.delta`. Dropping them is right.
- **The gap is discoverability, not correctness.** If Copilot ships an event carrying genuinely new semantics — interim usage (entry 4), a new reasoning shape, a new refusal or annotation type — the translating path will discard it silently while native consumers keep receiving it. Nothing would surface the divergence until a user reported missing data.
- **Possible solution**: `consola.debug` the unrecognised event type in the `default` branch, ideally once per type per stream to avoid flooding a 79-delta stream. This changes no output and no contract, so it carries none of the risk that emitting speculative chunks would. An allowlist of known-ignorable structural events keeps the log meaningful.
- **Trigger to file**: any investigation where "does the proxy see this event?" cannot be answered without adding temporary instrumentation — which is exactly what entries 1, 2 and 4 each required.

---

## How to use this file

When evidence for one of these flips from "could happen" to "happened in production" (a log line, a user report, a failing test, or a Copilot proxy change), promote it:

```bash
tpatch add --slug <slug> "<concise description copied from the entry>"
```

Then follow Path B (analyze / define / explore / implement / apply / record) like the 5 features in the April 2026 stability batch (`responses-stream-stable-ids-and-created`, `responses-stream-arg-divergence-guard`, `responses-stream-error-events`, `responses-stream-abort-propagation`, `messages-tool-result-validation`).

This file is **not** part of the standard tpatch workspace layout — it's a working backlog. Update or remove entries as they're filed, fixed, or invalidated by upstream changes.
