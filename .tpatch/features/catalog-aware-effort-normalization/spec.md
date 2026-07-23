# Specification

## Acceptance criteria

1. Exact catalog-supported effort values pass unchanged.
2. Unsupported recognized values fall back downward, e.g. `max` to `xhigh` and then `high`.
3. Values below a model's floor use its weakest advertised effort.
4. Missing or literal `auto` effort uses the route default when supplied and otherwise remains omitted.
5. A known model without `reasoning_effort` omits wire-level effort.
6. Anthropic, OpenAI Responses, and native Claude routes use the same resolver.
7. The proxy never infers effort from prompt text.
8. `bun test` passes.

## Out of scope

Dynamic prompt classification, changing model thinking algorithms, or inventing effort values absent from the catalog.
