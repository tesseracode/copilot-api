# Feature Request: Revert the Claude reroute on /chat/completions and let Claude models pass through to the upstream /chat/completions endpoint natively.

The chat-completions-native-reroute feature intercepted Claude models arriving on /chat/completions and rerouted them through native /v1/messages, translating Anthropic->OpenAI on the way back. Its stated rationale ('Claude on /chat/completions loses tool calling') is provably false against today's upstream API, and the reroute itself is lossy:

(1) Streaming tool calls are silently dropped. anthropicEventToOpenAIChunk (src/routes/chat-completions/handler.ts:322-358) maps only text_delta and message_delta.stop_reason; content_block_start/tool_use and input_json_delta both return null. Verified live: upstream /chat/completions emits full tool_calls deltas (id, name, index, incremental arguments) for claude-sonnet-5, while the proxy emits a single chunk {"delta":{},"finish_reason":"tool_calls"} with the tool name, id and arguments entirely missing - telling the client to expect a tool call that never arrives.

(2) Client disconnects do not propagate. handleNativeReroute calls forwardNativeMessagesNonStreaming at :190 and forwardNativeMessagesStreaming at :197 without the AbortSignal (both functions accept one), and its streamSSE has no abort catch, so an aborted stream keeps consuming Copilot quota. The responses-stream-abort-propagation feature missed this path.

(3) Thinking blocks are dropped anyway. extractAnthropicContent (:248-261) handles only text and tool_use block types, so the reroute never delivered the thinking preservation it was kept for.

Verified upstream behaviour for claude-sonnet-5 on /chat/completions: tool calls preserved streaming and non-streaming; copilot_usage still carries cache_read/cache_write and usage.prompt_tokens_details.cached_tokens; thinking not returned (but the reroute did not return it either). Net: passthrough is equal or better on every axis.

Scope: delete the endpoint === '/v1/messages' branch in handleCompletion, handleNativeReroute, and the four private translation helpers (mapAnthropicFinishReason, extractAnthropicContent, anthropicResponseToOpenAI, anthropicEventToOpenAIChunk), plus the imports they required. Claude requests then fall through to the existing createChatCompletions path, which already passes the request signal and has an abort catch. forward-native-messages.ts stays - /v1/messages still uses it. No change to the /v1/messages route: Anthropic-shaped clients keep full native passthrough.

Add tests/claude-chat-passthrough.test.ts as the regression test: mock fetch, seed state.models so the Claude model does advertise /v1/messages, drive server.request('/v1/chat/completions') with tools and stream:true, and assert (a) emitted chunks carry tool_calls with id, name and argument deltas, and (b) the upstream request went to /chat/completions rather than /v1/messages. This is the first end-to-end coverage of that route.

Supersedes chat-completions-native-reroute.

**Slug**: `claude-chat-completions-passthrough`
**Created**: 2026-07-25T17:05:19Z

## Description

Revert the Claude reroute on /chat/completions and let Claude models pass through to the upstream /chat/completions endpoint natively.

The chat-completions-native-reroute feature intercepted Claude models arriving on /chat/completions and rerouted them through native /v1/messages, translating Anthropic->OpenAI on the way back. Its stated rationale ('Claude on /chat/completions loses tool calling') is provably false against today's upstream API, and the reroute itself is lossy:

(1) Streaming tool calls are silently dropped. anthropicEventToOpenAIChunk (src/routes/chat-completions/handler.ts:322-358) maps only text_delta and message_delta.stop_reason; content_block_start/tool_use and input_json_delta both return null. Verified live: upstream /chat/completions emits full tool_calls deltas (id, name, index, incremental arguments) for claude-sonnet-5, while the proxy emits a single chunk {"delta":{},"finish_reason":"tool_calls"} with the tool name, id and arguments entirely missing - telling the client to expect a tool call that never arrives.

(2) Client disconnects do not propagate. handleNativeReroute calls forwardNativeMessagesNonStreaming at :190 and forwardNativeMessagesStreaming at :197 without the AbortSignal (both functions accept one), and its streamSSE has no abort catch, so an aborted stream keeps consuming Copilot quota. The responses-stream-abort-propagation feature missed this path.

(3) Thinking blocks are dropped anyway. extractAnthropicContent (:248-261) handles only text and tool_use block types, so the reroute never delivered the thinking preservation it was kept for.

Verified upstream behaviour for claude-sonnet-5 on /chat/completions: tool calls preserved streaming and non-streaming; copilot_usage still carries cache_read/cache_write and usage.prompt_tokens_details.cached_tokens; thinking not returned (but the reroute did not return it either). Net: passthrough is equal or better on every axis.

Scope: delete the endpoint === '/v1/messages' branch in handleCompletion, handleNativeReroute, and the four private translation helpers (mapAnthropicFinishReason, extractAnthropicContent, anthropicResponseToOpenAI, anthropicEventToOpenAIChunk), plus the imports they required. Claude requests then fall through to the existing createChatCompletions path, which already passes the request signal and has an abort catch. forward-native-messages.ts stays - /v1/messages still uses it. No change to the /v1/messages route: Anthropic-shaped clients keep full native passthrough.

Add tests/claude-chat-passthrough.test.ts as the regression test: mock fetch, seed state.models so the Claude model does advertise /v1/messages, drive server.request('/v1/chat/completions') with tools and stream:true, and assert (a) emitted chunks carry tool_calls with id, name and argument deltas, and (b) the upstream request went to /chat/completions rather than /v1/messages. This is the first end-to-end coverage of that route.

Supersedes chat-completions-native-reroute.
