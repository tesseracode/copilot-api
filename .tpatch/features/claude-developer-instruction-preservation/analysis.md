# Analysis — rejected after live measurement

The feature was filed from a short Claude developer-only probe that returned HTTP 200 without a useful marker, suggesting the instruction was ignored. Code inspection then showed the assumed converter (`openaiToAnthropicPayload`) has no production caller: Claude `/v1/chat/completions` passes the original Chat payload directly upstream.

A stronger live matrix used 256 output tokens and unique exact-response markers across Sonnet 4.6, Opus 4.8, and Haiku 4.5. All models honored developer-only instructions, system-only instructions, aligned mixed instructions, conflicting order in both directions, and a later developer message after an assistant turn. Later high-authority messages won consistently on the Chat path.

Conclusion: there is no production Claude developer-instruction loss at current upstream behavior. Modifying the dead Chat→Anthropic converter would not fix a runtime issue. Reject this feature unless a future caller restores native Messages rerouting or a model-specific regression appears.
