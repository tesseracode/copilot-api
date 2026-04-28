# Exploration: three-tier-routing-tests

## Existing Test Infrastructure

- Only one test file exists: `src/lib/filter-models.test.ts`
- No `scripts/` directory for e2e tests
- Test runner: `bun:test` (bun is the runtime)
- No `test:e2e` script in package.json

## Files to Test and Their Exported Symbols

### `src/lib/endpoint-routing.ts`
- `resolveEndpoint(modelId: string, cachedModels?: ModelsResponse): UpstreamEndpoint`
- Pure function, easy to test with mock `ModelsResponse` data
- Needs mock models with `supported_endpoints` arrays

### `src/lib/model-mapping.ts`
- `anthropicToCopilotModelId(model: string, is1MContext?: boolean): string`
- `copilotToAnthropicModelId(copilotModel: string): string`
- Pure functions, references `state.is1MContext` internally
- `MODEL_ID_MAP` and `REVERSE_MODEL_ID_MAP` are private — test through public functions

### `src/services/copilot/forward-native-messages.ts`
- `buildNativeBody()` is **not exported** — currently a private function (line 48)
- Options: (a) export it for testing, (b) test through `forwardNativeMessagesNonStreaming`/`Streaming` (requires mocking fetch), or (c) extract and export
- Recommended: export `buildNativeBody` — it's a pure-ish function (reads `state` for model mapping), valuable to test directly
- `normalizeThinking()` is also private (line 15) — test through `buildNativeBody`

### `src/services/copilot/create-responses.ts`
- `translateRequestToResponses(payload: ChatCompletionsPayload): ResponsesPayload` — exported, line 164
- `translateResponsesNonStreaming(resp: ResponsesResponse): ChatCompletionResponse` — exported, line 211
- `translateResponsesStreamEvent(event, streamState): Generator<ChatCompletionChunk>` — exported, line 299
- `createResponsesStreamState(): ResponsesStreamState` — exported, line 268
- All translation functions are pure — excellent test targets

## Test Files to Create

### Unit Tests

1. **`src/lib/endpoint-routing.test.ts`**
   - Mock `ModelsResponse` with various `supported_endpoints` combos
   - Test: Claude → `/v1/messages`, GPT-5.x → `/responses`, legacy → `/chat/completions`
   - Test: unknown model with no cached data → `/chat/completions`
   - Test: `-1m` suffix models

2. **`src/lib/model-mapping.test.ts`**
   - Test forward mapping: dash → dot format
   - Test reverse mapping: dot → dash format
   - Test 1M suffix handling both directions
   - Test unknown models pass through

3. **`src/services/copilot/forward-native-messages.test.ts`**
   - Requires `buildNativeBody` to be exported
   - Test: adaptive thinking → enabled with budget
   - Test: budget_tokens minimum 1024
   - Test: stop_sequences whitespace filtering (after sanitization fix)
   - Test: effort mapping (after effort fix)
   - Test: unknown fields stripped (output_config, etc.)

4. **`src/services/copilot/create-responses.test.ts`**
   - Test `translateRequestToResponses`: system→developer, max_tokens→max_output_tokens, tools, tool_choice
   - Test `translateResponsesNonStreaming`: output→choices, status mapping, usage
   - Test `translateResponsesStreamEvent`: SSE event sequence

### E2e Tests

5. **`scripts/e2e-test-suite.ts`**
   - Standalone script, no test framework dependency
   - Reads token from `state` or `~/.claude/copilot_github_token`
   - Hits `https://api.githubcopilot.com` directly
   - 13 tests across all three tiers (see spec for matrix)
   - Token redaction in all error output
   - Minimal max_tokens throughout

## Security Considerations

- Token source: `~/.claude/copilot_github_token` for e2e tests
- Must redact `Authorization`, `Bearer`, `ghu_*`, `tid=*` patterns in error output
- E2e tests should be opt-in only (`bun run test:e2e`)
- Never log full request/response headers

## Changes Needed Before Tests

- Export `buildNativeBody` from `forward-native-messages.ts`
- Add `test:e2e` script to `package.json`
