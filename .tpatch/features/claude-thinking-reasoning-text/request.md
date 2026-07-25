# Feature Request: Surface Claude thinking blocks as reasoning_text on the OpenAI-shaped /chat/completions endpoint.

Deferred, deliberately unimplemented. Filed while reverting chat-completions-native-reroute (see claude-chat-completions-passthrough) so the capability is tracked rather than lost.

Today, a Claude model sent to /chat/completions passes through to the upstream /chat/completions endpoint, which does not return thinking blocks - reasoning_effort is accepted and silently ignored, and the response message carries only role and content. The old reroute did not deliver thinking either: extractAnthropicContent handled only text and tool_use block types, so thinking blocks were dropped on that path too. No capability is being lost by the revert; this feature would be net-new.

If built, it should follow the convention the reasoning-block-preservation feature already established for GPT-5.x: map reasoning output to reasoning_text in /chat/completions responses and to thinking blocks in /v1/messages responses. That implies routing such requests through native /v1/messages (as the old reroute did) but with the three defects fixed: (1) a real Anthropic-events to OpenAI-chunks tool-call assembler with index bookkeeping and incremental argument deltas, mirroring the logic in create-responses.ts, (2) AbortSignal threaded to forwardNativeMessages*, (3) thinking blocks mapped to reasoning_text instead of being discarded. Multi-turn continuation additionally needs thinking signature round-tripping, which is the same blocker tracked by the reasoning-roundtrip feature.

Do not start this without a confirmed consumer. A survey of the intended stack (Claude Code, OpenClaw, Codex, Copilot CLI, Hermes, Pi agent, tpatch) found no client that both sends Claude models to an OpenAI-shaped endpoint and consumes thinking: Claude Code and OpenClaw use the native Anthropic Messages API for Claude, Codex uses wire_api=responses, and tpatch - the only confirmed consumer of the OpenAI-shaped path with a Claude model - wants parseable text/JSON, not thinking blocks.

Prerequisite: the tool-call assembler is the risky part. Four of the five April 2026 stability fixes landed in exactly that code in create-responses.ts, so this should reuse a shared assembler rather than growing a second copy.

**Slug**: `claude-thinking-reasoning-text`
**Created**: 2026-07-25T17:11:09Z

## Description

Surface Claude thinking blocks as reasoning_text on the OpenAI-shaped /chat/completions endpoint.

Deferred, deliberately unimplemented. Filed while reverting chat-completions-native-reroute (see claude-chat-completions-passthrough) so the capability is tracked rather than lost.

Today, a Claude model sent to /chat/completions passes through to the upstream /chat/completions endpoint, which does not return thinking blocks - reasoning_effort is accepted and silently ignored, and the response message carries only role and content. The old reroute did not deliver thinking either: extractAnthropicContent handled only text and tool_use block types, so thinking blocks were dropped on that path too. No capability is being lost by the revert; this feature would be net-new.

If built, it should follow the convention the reasoning-block-preservation feature already established for GPT-5.x: map reasoning output to reasoning_text in /chat/completions responses and to thinking blocks in /v1/messages responses. That implies routing such requests through native /v1/messages (as the old reroute did) but with the three defects fixed: (1) a real Anthropic-events to OpenAI-chunks tool-call assembler with index bookkeeping and incremental argument deltas, mirroring the logic in create-responses.ts, (2) AbortSignal threaded to forwardNativeMessages*, (3) thinking blocks mapped to reasoning_text instead of being discarded. Multi-turn continuation additionally needs thinking signature round-tripping, which is the same blocker tracked by the reasoning-roundtrip feature.

Do not start this without a confirmed consumer. A survey of the intended stack (Claude Code, OpenClaw, Codex, Copilot CLI, Hermes, Pi agent, tpatch) found no client that both sends Claude models to an OpenAI-shaped endpoint and consumes thinking: Claude Code and OpenClaw use the native Anthropic Messages API for Claude, Codex uses wire_api=responses, and tpatch - the only confirmed consumer of the OpenAI-shaped path with a Claude model - wants parseable text/JSON, not thinking blocks.

Prerequisite: the tool-call assembler is the risky part. Four of the five April 2026 stability fixes landed in exactly that code in create-responses.ts, so this should reuse a shared assembler rather than growing a second copy.
