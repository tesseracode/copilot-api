# Analysis

Controlled probes and a six-case red test show that Responses refusal/filter semantics are dropped. Streaming content_filter becomes Anthropic end_turn; refusal delta/done events disappear; non-stream incomplete/filter and refusal items become empty normal stop.

OpenAI Chat already defines `content_filter` as a completion reason and Anthropic types already support `stop_reason: refusal`. The compatible fix preserves refusal text and maps content filtering to Anthropic refusal, not permission errors. Native Responses passthrough remains unchanged.
