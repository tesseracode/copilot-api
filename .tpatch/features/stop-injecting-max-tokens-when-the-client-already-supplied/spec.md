# Specification

1. A Chat request carrying `max_completion_tokens` and no `max_tokens` is forwarded upstream without an injected `max_tokens`.
2. A Chat request carrying `max_tokens` is forwarded with the client's value unchanged, as today.
3. A Chat request carrying neither control still receives the catalog `capabilities.limits.max_output_tokens` default, preserving current behavior.
4. A Chat request carrying both controls is forwarded unchanged; the proxy does not add, remove, or reconcile either field on the client's behalf.
5. The proxy never emits both `max_tokens` and `max_completion_tokens` when the client sent only one of them.
6. `max_completion_tokens` is a recognized optional field on the Chat payload type so the behavior is expressed in types rather than relying on runtime passthrough of an unknown key.
7. An explicit `null` `max_tokens` alongside a present `max_completion_tokens` is treated as "client supplied a token control" and does not trigger injection.
8. Behavior is identical for streaming and non-streaming Chat requests.
9. Requests routed to `/responses` and to native Messages are unchanged, including the existing non-null `max_tokens` to `max_output_tokens` mapping and the Anthropic `?? 4096` default.
10. Regression tests cover all four combinations — only `max_tokens`, only `max_completion_tokens`, both, and neither — asserting the exact upstream payload in each case.
