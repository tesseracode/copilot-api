# Feature Request: Add /v1/messages native routing to the /chat/completions handler: when resolveEndpoint returns /v1/messages for a Claude model sent to /chat/completions, reroute to native passthrough instead of forwarding through the lossy /chat/completions translation. Not a bug fix (upstream /chat/completions works for Claude) but an optimization for preserving thinking blocks and prompt caching.

**Slug**: `chat-completions-native-reroute`
**Created**: 2026-05-01T07:43:54Z

## Description

Add /v1/messages native routing to the /chat/completions handler: when resolveEndpoint returns /v1/messages for a Claude model sent to /chat/completions, reroute to native passthrough instead of forwarding through the lossy /chat/completions translation. Not a bug fix (upstream /chat/completions works for Claude) but an optimization for preserving thinking blocks and prompt caching.

SUPERSEDED BY claude-chat-completions-passthrough (2026-07-25).

Do not re-litigate this feature: its stated rationale is provably false against the current upstream API. Measured directly against api.githubcopilot.com for claude-sonnet-5, upstream /chat/completions preserves tool calls in BOTH streaming and non-streaming, and still reports cache_read/cache_write in copilot_usage plus usage.prompt_tokens_details.cached_tokens.

The reroute itself was lossy: anthropicEventToOpenAIChunk mapped only text_delta and message_delta.stop_reason, so streaming tool calls were dropped while finish_reason=tool_calls was still emitted - clients were told to expect a tool call whose name, id and arguments never arrived. It also never passed the AbortSignal to forwardNativeMessages*, and extractAnthropicContent dropped thinking blocks, so the thinking preservation it was retained for was never actually delivered.

The reroute was removed rather than repaired: deleting it let Claude fall through to the existing createChatCompletions path, which already threads the signal and already has an abort catch. See .tpatch/features/claude-chat-completions-passthrough/ for the analysis, and .tpatch/RETROSPECTIVE.md for the tooling implications.
