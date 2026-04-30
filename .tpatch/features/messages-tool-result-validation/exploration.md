# Exploration: messages-tool-result-validation

## Files to change

1. `src/services/copilot/create-chat-completions.ts` — append `AudioPart` interface and extend the `ContentPart` union (around lines 188-201).
2. `src/lib/error.ts` — add `badRequest` helper, refactor `forwardError`'s HTTPError branch.
3. `src/services/copilot/create-responses.ts` — rewrite `translateMessageContent` (lines 51-72).
4. `src/routes/messages/non-stream-translation.ts` — validate in `handleUserMessage` (lines 88-123).

## Files to add

- `tests/messages-tool-result-validation.test.ts`.

## Imports needed

- `non-stream-translation.ts` does not currently import from `~/lib/error`. Add `import { badRequest } from "~/lib/error"` at the top.
- `create-responses.ts` already imports `consola` (line 1).
- `error.ts` already imports `consola` (line 4).

## Insertion-point anchors

1. **`ContentPart`** (chat-completions):
   ```
   export type ContentPart = TextPart | ImagePart

   export interface TextPart {
     type: "text"
     text: string
   }

   export interface ImagePart {
     type: "image_url"
     image_url: {
       url: string
       detail?: "low" | "high" | "auto"
     }
   }
   ```
   Replace the union and append `AudioPart` after `ImagePart`.

2. **`translateMessageContent`** body — anchor on the full block, lines 51-72.

3. **`handleUserMessage`** loop — anchor on the `for (const block of toolResultBlocks)` block (lines 101-107), insert validation as first step inside the loop.

4. **`forwardError`** — anchor on the entire function body.

## Existing tests to preserve

- `tests/anthropic-request.test.ts` — exercises `translateToOpenAI`, including tool_result blocks. Confirm none of its tool_result inputs have empty `tool_use_id`.
- `tests/anthropic-response.test.ts`, `tests/responses-stream-stable-ids.test.ts`, `tests/responses-stream-arg-divergence-guard.test.ts`, `tests/responses-stream-error-events.test.ts`, `tests/responses-stream-abort-propagation.test.ts`, `src/lib/*.test.ts`, `src/services/copilot/forward-native-messages.test.ts`. Should remain green; the `ContentPart` union widening is additive.

## Test design

- For translateMessageContent, call directly. It is not exported today — confirm. If not exported, add `export` to make it testable. **Verified**: `translateMessageContent` is currently a private function in `create-responses.ts`. Two options: (a) export it, (b) test it through `createResponses` with mocked fetch. Option (a) is cleaner and lower cost — the function name is already specific enough. Plan: export it.
- For empty `tool_use_id`, exercise via `translateToOpenAI(payload)` where `payload.messages[0].content` contains a `tool_result` with empty `tool_use_id`. Expect throw.
- For `forwardError`: build a minimal mock `Context` exposing `json(body, status)`. Call `forwardError(c, new HTTPError("...", new Response(JSON.stringify({error:{message:"x"}}), {status: 400})))`. Assert `c.json` was called with the upstream object.

## Smallest changeset

- 1 op against `create-chat-completions.ts` (extend union).
- 2 ops against `error.ts` (add helper + refactor function).
- 1 op against `create-responses.ts` (rewrite translateMessageContent + add `export`).
- 1 op against `non-stream-translation.ts` (validation + import).
- 1 new test file.

Total: 6 operations.

## Live probe

Earlier probe (Probe C, run during this engagement):

```
{"error":{"message":"{\"error\":{\"message\":\"Invalid 'input[2].call_id': empty string. ...\",\"code\":\"invalid_request_body\"}}\n","type":"error"}}
```

After the fix, repeat the probe. Expected: HTTP 400 with body roughly:

```
{"error":{"type":"invalid_request_error","message":"tool_result block is missing tool_use_id"}}
```

(Single envelope, our local validation, never reaches Copilot.)
