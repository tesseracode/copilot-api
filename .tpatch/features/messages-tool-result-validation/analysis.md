# Analysis: messages-tool-result-validation

## Summary

Three related correctness gaps in the Anthropic → OpenAI → /responses translation chain plus the proxy's error envelope:

1. **Multimodal coercion in `translateMessageContent`** (`src/services/copilot/create-responses.ts:51-72`). Today, the function returns `input_text` for `type: "text"` parts and **unconditionally** wraps every other part as an `input_image` with `image_url: p.image_url?.url`. If the OpenAI-format ContentPart was an `image_url`, this works coincidentally; if it was anything else (or a malformed image with missing url), the function emits an `input_image` whose `image_url` is `undefined`. Fix: explicit per-type branches, validate that `image_url.url` is present, support `input_audio` if/when it appears in the OpenAI ContentPart union, and drop unknown types with a warn.

2. **Empty `tool_use_id` forwarded upstream** (`src/routes/messages/non-stream-translation.ts:101-107`). The Anthropic → OpenAI translator copies `block.tool_use_id` straight into `tool_call_id`. If the client sends `tool_use_id: ""` (or omits it), the translator forwards an empty string, which Copilot's `/responses` returns as a 400. The probe earlier in this engagement confirmed this. Fix: validate at the translator entry, throw a 400 with a clean message before any upstream call.

3. **Double-encoded upstream error bodies in `forwardError`** (`src/lib/error.ts:18-36`). When `HTTPError` carries a Response whose JSON body already follows `{error: {message, type, code}}` (Copilot's shape), `forwardError` JSON-parses then **re-stringifies** it into the `message` field of our own envelope. Result: `{"error":{"message":"{\"error\":{...}}", "type":"error"}}`. Fix: detect the well-formed `{error: {...}}` upstream shape and pass it through with the upstream status; only wrap raw or non-conforming bodies.

The three issues compose: validating `tool_use_id` cleanly relies on `forwardError` not re-encoding the synthetic 400 we throw.

## Compatibility

**Status**: compatible

- Adding `AudioPart` as a third member of the `ContentPart` union is additive. Existing consumers narrow on `type === "text" | "image_url"` and ignore extras.
- The 400 thrown for empty `tool_use_id` is a behavioural improvement: previously the same input also produced a 400, but with an opaque double-encoded body; now it's a clean 400 with a precise message and never reaches Copilot.
- The `forwardError` change only affects the body of error responses for clients; status codes and the broad envelope shape are unchanged for non-conforming upstream bodies.

## Affected Areas

- `src/services/copilot/create-chat-completions.ts` — extend `ContentPart` with optional `AudioPart`.
- `src/services/copilot/create-responses.ts` — rewrite `translateMessageContent` with explicit branching.
- `src/routes/messages/non-stream-translation.ts` — validate `tool_use_id` in `handleUserMessage`.
- `src/lib/error.ts` — pass through well-formed upstream error envelopes; add small `badRequest` helper for synthesised 400 responses.
- New test file `tests/messages-tool-result-validation.test.ts`.

## Acceptance Criteria

1. `translateMessageContent` returns the correct `/responses` part for each input ContentPart:
   - `text` → `{ type: "input_text", text }`.
   - `image_url` with non-empty `url` → `{ type: "input_image", image_url, detail }`.
   - `image_url` with missing/empty `url` → dropped with a `consola.warn`.
   - `input_audio` (new ContentPart variant) → `{ type: "input_audio", input_audio: { data, format } }`.
   - any other type → dropped with a `consola.warn` carrying the unknown type label.
2. `handleUserMessage` rejects `tool_result` blocks whose `tool_use_id` is empty or missing by throwing a `HTTPError` whose synthesised `Response` has status `400` and body `{"error":{"type":"invalid_request_error","message":"tool_result block is missing tool_use_id"}}`.
3. `forwardError`, when given an `HTTPError` whose response body parses as `{error: {message: string, ...}}`, returns that exact JSON object to the client (no `message` re-wrapping). Other `HTTPError` bodies remain wrapped in our `{error: {message, type:"error"}}` envelope.
4. New tests cover: image_url passthrough; empty image_url drop; input_audio passthrough; unknown type drop with warn; empty tool_use_id throws; forwardError pass-through of `{error: {...}}` bodies; forwardError wrapping of plain-text bodies.
5. Live probe (already run in earlier session) reproduces a clean 400 with un-nested error JSON for empty tool_use_id input.
6. `bun test`, `bun run lint`, `bun run typecheck` pass with no new errors over the pre-existing baseline.

## Implementation Notes

- `AudioPart` shape:
  ```ts
  export interface AudioPart {
    type: "input_audio"
    input_audio: { data: string; format: "wav" | "mp3" }
  }
  ```
- For `translateMessageContent`, switch on `p.type`. The function's input type widens to `ContentPart` after the union extension.
- `badRequest(message)` helper in `src/lib/error.ts`: builds and returns a `new HTTPError(message, new Response(JSON.stringify({error: {type: "invalid_request_error", message}}), { status: 400, headers: {"content-type":"application/json"}}))`.
- `forwardError` discriminator: after `JSON.parse`, if `errorJson` is a non-null object with an `error` property whose value is also a non-null object containing a string `message`, return `c.json(errorJson, status)` directly.

## Unresolved Questions

- Whether to also surface `tool_call_id` validation on the assistant tool_use side (tool_use blocks with empty `id`). Lower priority — Anthropic SDK rarely emits empty ids on assistant turns. Defer.
- Whether the audio part type should accept `"webm" | "ogg"` formats. Stick to OpenAI-spec `"wav" | "mp3"` for now; widen later if needed.
