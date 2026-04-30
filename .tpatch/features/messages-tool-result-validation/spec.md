# Specification: messages-tool-result-validation

## Acceptance Criteria

1. **`ContentPart` union extended with `AudioPart`** (`src/services/copilot/create-chat-completions.ts`):
   ```ts
   export type ContentPart = TextPart | ImagePart | AudioPart
   export interface AudioPart {
     type: "input_audio"
     input_audio: { data: string; format: "wav" | "mp3" }
   }
   ```

2. **`translateMessageContent` returns explicit per-type parts** (`src/services/copilot/create-responses.ts`):
   - `text` part → `{ type: "input_text", text: p.text ?? "" }`.
   - `image_url` part with truthy `image_url.url` → `{ type: "input_image", image_url: p.image_url.url, detail: p.image_url.detail }`.
   - `image_url` part with missing/empty `image_url.url` → dropped; `consola.warn` invoked once with `{ reason: "missing image_url.url" }`.
   - `input_audio` part → `{ type: "input_audio", input_audio: { data, format } }`.
   - any other type → dropped; `consola.warn` invoked once with `{ unknownType: p.type }`.
   - String content remains pass-through unchanged.

3. **Empty `tool_use_id` rejected before upstream call** (`src/routes/messages/non-stream-translation.ts`):
   - `handleUserMessage` iterates over tool_result blocks; if `block.tool_use_id` is `undefined`, `null`, or an empty/whitespace-only string, the translator throws `badRequest("tool_result block is missing tool_use_id")`.
   - The thrown error is an `HTTPError` whose `response.status === 400` and body is `{"error":{"type":"invalid_request_error","message":"tool_result block is missing tool_use_id"}}`.

4. **`forwardError` passes through well-formed upstream envelopes** (`src/lib/error.ts`):
   - On `HTTPError`, if `JSON.parse(response.text())` yields an object of shape `{ error: { message: string, ... } }`, return `c.json(parsed, status)` unchanged.
   - Otherwise, return `c.json({ error: { message: <text or string-cast>, type: "error" } }, status)` (current behaviour).
   - The status code is always taken from `error.response.status`.

5. **`badRequest(message: string): HTTPError` helper exported from `src/lib/error.ts`**:
   ```ts
   export function badRequest(message: string): HTTPError {
     return new HTTPError(
       message,
       new Response(
         JSON.stringify({ error: { type: "invalid_request_error", message } }),
         { status: 400, headers: { "content-type": "application/json" } },
       ),
     )
   }
   ```

6. **Tests** under `tests/messages-tool-result-validation.test.ts`:
   - `translateMessageContent`:
     - text part → input_text.
     - image_url part with url → input_image with url and detail.
     - image_url part with empty url → returns array missing that part, `consola.warn` called.
     - input_audio part → input_audio with data and format.
     - unknown type → dropped with warn.
   - `translateToOpenAI` / `handleUserMessage`:
     - tool_result block with empty tool_use_id throws an `HTTPError` whose response status is 400 and body parses to `{error:{type:"invalid_request_error", message:"tool_result block is missing tool_use_id"}}`.
     - tool_result block with valid tool_use_id translates normally.
   - `forwardError`:
     - HTTPError with body `{"error":{"message":"x","code":"y"}}` produces a Hono response whose JSON is exactly that object (no nesting), with the upstream status code.
     - HTTPError with plain-text body produces the existing wrapped envelope.

7. **Lint / typecheck / tests** all pass (no new errors over baseline).

## Out of Scope

- Validating the `tool_use.id` on assistant turns (only `tool_result.tool_use_id` on user turns).
- Adding image content beyond `image_url` (e.g. `image_file`).
- Audio format extension beyond `"wav" | "mp3"`.
- Streaming-side error envelope changes (handled by `responses-stream-error-events`).

## Implementation Plan

1. **`src/services/copilot/create-chat-completions.ts`** — extend the `ContentPart` union and add `AudioPart`.

2. **`src/lib/error.ts`** — add `badRequest` helper and refactor `forwardError` to pass-through well-formed `{error: {...}}` JSON.

3. **`src/services/copilot/create-responses.ts`** — rewrite `translateMessageContent` to switch on `p.type` with explicit branches and drop-with-warn fallthrough.

4. **`src/routes/messages/non-stream-translation.ts`** — import `badRequest` from `~/lib/error`; validate `tool_use_id` in `handleUserMessage` before pushing the tool message.

5. **Tests** — add `tests/messages-tool-result-validation.test.ts` covering the four areas in criterion (6).

6. **Run lint/test/typecheck.** Live probe (curl to /v1/messages with empty tool_use_id) confirms the new clean 400.

## Risks

- **Test mocking the Hono Context for `forwardError`**: `forwardError` takes a Hono `Context`. Easiest: build a real Hono app in the test, hit a route that throws the HTTPError, inspect the Response. Or: mock `c.json` directly. The latter is lighter; we'll go that route.
- **`mapContent` upstream of `translateMessageContent`** still funnels Anthropic content into OpenAI ContentPart shape; audio currently has no input path because Anthropic has no audio block. The audio handling in `translateMessageContent` is forward-compat, exercised only by direct unit tests.
- **`badRequest` synthesises a Response in memory** — its `text()` is async but the body is a small JSON literal; Bun and Node's WHATWG `Response` handle this without I/O.
