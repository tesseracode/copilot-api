# Analysis

`chat-completions-native-reroute` is a **shallow module doing lossy work**: ~185 lines in
`src/routes/chat-completions/handler.ts` whose entire job is to translate a Claude request
into Anthropic shape, forward it natively, and translate the answer back into the OpenAI shape
the caller already asked for. Upstream performs that same round trip natively, and better.

The rationale recorded in `.tpatch/features/chat-completions-native-reroute/analysis.md`
("Claude on /chat/completions loses tool calling. Native /v1/messages passthrough preserves
it.") does not hold against today's upstream. Measured against `claude-sonnet-5`:

| | upstream `/chat/completions` | reroute |
|---|---|---|
| tool calls, non-streaming | preserved | preserved |
| tool calls, streaming | full deltas (id, name, index, incremental args) | **dropped** |
| `copilot_usage` cache_read / cache_write | present | present |
| `usage.prompt_tokens_details.cached_tokens` | present | present |
| thinking blocks | not returned | **also dropped** |

So the reroute delivers none of its three claimed benefits and actively breaks one. The
streaming failure is worse than a silent drop: the proxy still emits
`finish_reason: "tool_calls"`, so the client is told to expect a tool call whose name, id, and
arguments never arrive.

Two of the three defects vanish by deletion rather than by fix. Removing the branch lets Claude
fall through to the existing `createChatCompletions` path, which already threads the request
signal and already has an abort catch — so the missing-signal leak is repaired by subtraction.

Applying the deletion test: removing `handleNativeReroute` concentrates no complexity anywhere.
Upstream absorbs the behaviour. That is the signal to delete rather than deepen.

Consumer check across the intended stack — Claude Code, OpenClaw, Codex, Copilot CLI, Hermes,
Pi, tpatch — found exactly one client that sends a Claude model to an OpenAI-shaped endpoint:
`tpatch` itself (`.tpatch/config.yaml`: `type: openai-compatible`, `model: claude-haiku-4.5`).
It consumes text/JSON and does not want thinking blocks, and it gains working streaming tool
calls. Claude Code and OpenClaw use the native Anthropic Messages API for Claude; Codex uses
`wire_api = "responses"`. The `/v1/messages` route is untouched by this change.
