# Analysis

Four classes of duplication sat across the two route handlers, all of them in the streaming
path:

| Duplication | Copies | Location |
|---|---|---|
| abort-catch block | 5 | `messages/handler.ts` ×3, `chat-completions/handler.ts` ×2 |
| `isNonStreaming` definition | 2 | one per handler, byte-identical |
| `AnthropicStreamState` literal | 2 | both in `messages/handler.ts` |
| `/responses` SSE consume loop | 2 | one per handler |

The five catch blocks are structurally identical, differing only in `signal.aborted` versus
`signal?.aborted` — an accident of local typing rather than semantics — and in their debug
label. That means the answer to "what does it mean that the client went away?" is written out
five times and can drift five ways. This codebase has already shipped two separate defects in
exactly that area (`responses-stream-abort-propagation`, and the missing signal in the reroute
removed by `claude-chat-completions-passthrough`), so the cost is not hypothetical.

The `AnthropicStreamState` duplication is the clearest case: `createResponsesStreamState`
already exists as a factory for the sibling state object, so the pattern was established and
simply not applied.

Applying the deletion test to a shared helper: removing five copies concentrates the definition
in one place rather than pushing complexity outward. That is the signal to extract.

Scope is deliberately limited to the first three classes. The two `/responses` consume loops
differ in what they emit (Anthropic events versus raw chunks), there are only two call sites,
and that pipeline is where four of the five April 2026 stability fixes landed. Candidate 4 of
the architecture review proposes deepening it properly; disturbing it piecemeal here would be
worse than leaving it.

This is not a line-count win. The handlers shed roughly 55 lines and the shared module adds
about 60 back, most of it documentation. The gain is locality.
