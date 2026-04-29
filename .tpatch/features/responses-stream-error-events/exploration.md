# Exploration: responses-stream-error-events

## Files to change

1. `src/services/copilot/create-chat-completions.ts` — add `error?` to `ChatCompletionChunk` (line 51–70).
2. `src/services/copilot/create-responses.ts`:
   - Extend `ResponsesStreamResponse` (line 326–330).
   - Extend `ResponsesStreamEventData` (line 340–350).
   - Add three new handler generators (placed alongside the existing `handleCompletedEvent` near line 678).
   - Add three new cases to the switch in `translateResponsesStreamEvent` (line 695).
   - Add a small `mapIncompleteReasonToFinishReason` helper.
3. `src/routes/messages/stream-translation.ts`:
   - Add error short-circuit at the top of `translateChunkToAnthropicEvents` (line 21+).
   - Update `translateErrorToAnthropicErrorEvent` signature (line 183–191).

## Files to add

- `tests/responses-stream-error-events.test.ts`.

## Imports

- `consola` already imported in `create-responses.ts` (line 1). No new imports.
- `translateErrorToAnthropicErrorEvent` is already exported from `stream-translation.ts` and imported nowhere production-side today. After this change, it gets called from inside `translateChunkToAnthropicEvents`. No new exports needed.

## Existing test coverage to preserve

- `tests/anthropic-response.test.ts` — full file, especially the `Responses API to Anthropic Streaming Response Translation` describe at line 457. None of its assertions involve `chunk.error` or terminal-error events; should remain green.
- `tests/responses-stream-stable-ids.test.ts` (feature 1).
- `tests/responses-stream-arg-divergence-guard.test.ts` (feature 2).

## Insertion points (recipe-friendly anchors)

1. **`ChatCompletionChunk` interface** — anchor on the closing brace of the interface in `create-chat-completions.ts`:
   ```
       completion_tokens_details?: {
         accepted_prediction_tokens: number
         rejected_prediction_tokens: number
       }
     }
   }
   ```
   Replace by appending an `error?` field above the final `}`. Use a unique multi-line anchor.

2. **`ResponsesStreamResponse` interface** — anchor on the full block:
   ```
   interface ResponsesStreamResponse {
     id?: string
     model?: string
     usage?: ResponsesStreamUsage
   }
   ```

3. **`ResponsesStreamEventData` interface** — anchor on the full block.

4. **Switch in `translateResponsesStreamEvent`** — anchor on the `default` clause to insert new cases just before it.

5. **New handler functions** — append before `export function* translateResponsesStreamEvent` (around line 695). Use `replace-in-file` with the function signature line as anchor.

6. **`translateChunkToAnthropicEvents` short-circuit** — anchor on the early-return guard:
   ```
     if (chunk.choices.length === 0) {
       return events
     }
   ```
   Insert error-handling logic between this guard and the `const choice = ...` line.

7. **`translateErrorToAnthropicErrorEvent`** — anchor on the full current body:
   ```
   export function translateErrorToAnthropicErrorEvent(): AnthropicStreamEventData {
     return {
       type: "error",
       error: {
         type: "api_error",
         message: "An unexpected error occurred during streaming.",
       },
     }
   }
   ```

## `incomplete_details.reason` mapping

| upstream reason          | OpenAI finish_reason | Anthropic stop_reason (via `mapOpenAIStopReasonToAnthropic`) |
|--------------------------|----------------------|---------------------------------------------------------------|
| `max_output_tokens`      | `length`             | `max_tokens`                                                  |
| `content_filter`         | `content_filter`     | `end_turn` (current mapper default — verify and adjust if needed) |
| (anything else / absent) | `stop`               | `end_turn`                                                    |

`mapOpenAIStopReasonToAnthropic` is in `src/routes/messages/utils.ts`. We do not edit it — only call it. If `content_filter` doesn't already map to a useful Anthropic value, the test will surface that and we can decide separately whether to extend the mapper.

## Acceptance test outline

`tests/responses-stream-error-events.test.ts`:

1. **`response.failed` ends stream with Anthropic error event**: feed a normal opening (`response.created`, one `output_text.delta`) then `response.failed` with `response.error = { type: "rate_limit_exceeded", message: "..." }`. Pipe chunks through `translateChunkToAnthropicEvents`. Assert: chunks include exactly one chunk with `error` set; Anthropic events end with one event of type `error` with the same payload; no `message_stop` after that error; the open content block is closed via `content_block_stop`.
2. **`error` (generic SSE) ends stream**: similar setup, `error` event with `code: "internal_error"`, `message: "..."`. Same assertions.
3. **`response.incomplete` with `max_output_tokens`**: feed open + delta + `response.incomplete` with `incomplete_details.reason: "max_output_tokens"`. Assert: terminal chunk has `finish_reason: "length"`; Anthropic events include `message_delta` with `stop_reason: "max_tokens"` and `message_stop`; no `error` event.
4. **`response.incomplete` with absent reason**: same as (3) but `incomplete_details: {}`; assert `finish_reason: "stop"`.
5. **`consola.warn` spy**: warns once for (1) and (2); silent for (3) and (4).

## Smallest changeset

- 1 op against `create-chat-completions.ts`.
- 4 ops against `create-responses.ts` (interface, interface, new handlers, switch).
- 2 ops against `stream-translation.ts` (short-circuit + signature update).
- 1 new test file.

Total: 8 operations in the recipe.
