# Analysis

`handleCompletion` injects a catalog-derived token limit whenever the inbound payload has no `max_tokens` (`src/routes/chat-completions/handler.ts:50`), and `createChatCompletions` forwards the payload with `body: JSON.stringify(payload)` (`src/services/copilot/create-chat-completions.ts:45`). Because the request object is passed through verbatim, any field the client sent that is not part of `ChatCompletionsPayload` — including `max_completion_tokens` — still reaches upstream. TypeScript's interface does not strip unknown keys at runtime, so the two facts combine: the client's `max_completion_tokens` survives, and the proxy adds `max_tokens` beside it.

A direct upstream probe on `claude-opus-4.6` isolates the outcome precisely:

| Request | Result |
| --- | --- |
| only `max_tokens` | HTTP 200 |
| only `max_completion_tokens` | HTTP 200 |
| neither | HTTP 200 |
| both | HTTP 400 `max_tokens and max_completion_tokens cannot both be set` |

This confirms the gateway's report (`tg-zq7.42.8.1`) and identifies this repository as the injector rather than the client or the gateway. VS Code Copilot Chat sends `max_completion_tokens` when thinking is enabled, so the proxy converts a valid client request into an upstream rejection. Native Messages routing is unaffected because it never passes through this handler, which matches the gateway's observation that the preferred native path still works.

The `neither → 200` row is the important secondary result: the injection is not required for a successful request. It is a convenience default that raises the output ceiling to the catalog maximum, not a correctness requirement. That bounds the fix — the defaulting behavior can be made conditional without needing to prove that upstream tolerates an absent limit, because it demonstrably does.

The blast radius is limited to the Chat path. `create-responses.ts:214` maps `max_tokens` to `max_output_tokens` only when non-null and never invents a value, and the Anthropic paths either forward `payload.max_tokens` unchanged or apply a `?? 4096` default on a field the Anthropic contract already requires (`anthropic-types.ts:9`), so neither can produce this conflict.

The injection is upstream code, introduced by `3c44634` ("Add model cache and auto max_tokens based on model selection"), and no tpatch feature currently owns that line. Changing it is therefore a genuine fork customization that needs its own recorded feature rather than an amendment to an existing one.

The minimal correct fix is to treat `max_completion_tokens` as an existing token control: skip the injection when the client supplied either field. Removing the default outright would be a larger behavioral change for every client that currently relies on getting the catalog maximum, and the evidence does not require it.
