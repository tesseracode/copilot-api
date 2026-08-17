# Specification

## Recovery behavior

1. A `response.function_call_arguments.delta` that resolves to no existing tool call is buffered against its `output_index` instead of being discarded.
2. A buffered delta produces no output chunk at the time it arrives, because the tool call's `id` and `name` are not yet known.
3. When `response.output_item.added` creates the tool call for that `output_index`, the buffered text is folded into the tool call's arguments and included in the emitted first chunk.
4. The client assembles the complete arguments for the racing sequence: `delta` → `added` → `delta` → `done` yields exactly the arguments the provider sent.
5. Buffered text is consumed exactly once and cleared, so it can never be applied twice.
6. If the added event's `item.arguments` already contains the buffered text, it is used as-is rather than duplicated by prepending.
7. A stale buffer for an `output_index` is discarded when an item at that index completes, so it cannot leak into a later item that reuses the index.
8. A delta with no resolvable tool call that is never followed by an added event still yields correct arguments when `output_item.done` supplies the complete `item.arguments`.

## Non-regression

9. The normal ordering — `added` before any delta — produces byte-identical output to today, with no buffer written and no extra chunk emitted.
10. Tool calls are still only created where both `call_id` and `name` are known, so every emitted first chunk carries `id` and `function.name`.
11. `syncToolArguments` and the argument-divergence guard are not modified.
12. After a flush, `done` sees the accumulated prefix match and therefore emits no duplicate text and logs no divergence warning.
13. The Anthropic path continues to open a `content_block_start` for every tool call and to receive the full `input_json_delta` sequence.
14. Buffer state lives on the per-stream state object, so concurrent streams cannot observe each other's buffered deltas.
15. Text deltas, refusals, reasoning items, usage, and finish reasons are unaffected.

## Coverage

16. Tests cover the racing sequence end to end on the OpenAI chunk path and assert the exact assembled arguments.
17. Tests assert the normal ordering is unchanged and that no divergence warning is emitted in either ordering.
18. Tests cover the racing sequence through the Anthropic translation, asserting one `content_block_start` and the complete `input_json_delta` text.
19. Tests cover an orphan delta completed only by `output_item.done`, and an orphan buffer that must not be applied to a later item reusing the same `output_index`.
