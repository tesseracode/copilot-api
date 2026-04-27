# Exploration: log-model-display-name

## Relevant Files

- `src/lib/request-logger.ts`
  - Primary logging utility for request log lines.
  - Relevant sections:
    - Any function that builds request log context/fields.
    - Any formatted log message that currently includes `model`.
    - Any exported request logging helper called from chat/messages/proxy routes.
  - This is the main place to enrich existing model ID logging with `model_display_name`.

- `src/services/copilot/get-models.ts`
  - Likely source of Copilot model fetching and in-memory cached model data.
  - Relevant sections:
    - Existing cache variable/state for the models list.
    - Existing refresh/fetch function.
    - Existing exported function used by `GET /models`.
  - Best candidate location to expose a synchronous cache-only lookup helper, for example:
    - `getCachedModelDisplayName(modelId: string): string | undefined`
    - or `getCachedModelById(modelId: string)`

- `src/routes/models/route.ts`
  - Route that likely serves the cached/fetched models list.
  - Relevant sections:
    - Handler for listing models.
    - Any model normalization/mapping before response.
  - Useful to confirm the model object shape and whether `display_name` is available in the cached list.

- `src/routes/chat-completions/handler.ts`
  - Chat completions request handling.
  - Relevant sections:
    - Extraction of `model` from the request body.
    - Calls into `request-logger.ts`.
    - Any model mapping before forwarding to Copilot.
  - Ensure the display name is attached to the same model ID currently being logged.

- `src/routes/chat-completions/route.ts`
  - Route wrapper for chat completions.
  - Relevant sections:
    - Any request logging middleware or handler invocation.
    - Error/logging flow around the handler.

- `src/routes/messages/handler.ts`
  - Anthropic Messages request handling.
  - Relevant sections:
    - Extraction of Anthropic `model`.
    - Translation/mapping to Copilot/OpenAI-compatible model IDs.
    - Calls into request logging.
  - Important for deciding whether the logged model ID is the original Anthropic model or the mapped/effective Copilot model.

- `src/routes/messages/route.ts`
  - Route wrapper for Anthropic Messages.
  - Relevant sections:
    - Logging call sites.
    - Handler invocation and error behavior.

- `src/routes/messages/non-stream-translation.ts`
  - Non-streaming Anthropic/OpenAI translation logic.
  - Relevant sections:
    - Any model ID transformation or logged request metadata.
  - Useful if logging happens after translation.

- `src/routes/messages/stream-translation.ts`
  - Streaming Anthropic/OpenAI translation logic.
  - Relevant sections:
    - Any model ID transformation or logged request metadata.
  - Useful if streaming logs include the model ID separately.

- `src/routes/embeddings/route.ts`
  - Embeddings request route.
  - Relevant sections:
    - Extraction/logging of embedding model ID.
  - Include this if embeddings request logs currently include a model ID.

- `src/lib/proxy.ts`
  - Generic proxy/forwarding utilities.
  - Relevant sections:
    - Any centralized request logging for forwarded Copilot requests.
    - Any structured log context containing `model`.
  - Important if model logging is centralized outside route handlers.

- `src/lib/model-mapping.ts`
  - Model alias/mapping utility.
  - Relevant sections:
    - Mapping from requested model ID to effective Copilot model ID.
    - Any helper used by chat/messages handlers.
  - The new display-name lookup should enrich whichever model ID is already logged, without changing mapping behavior.

- `tests/`
  - Existing test suite currently includes:
    - `tests/anthropic-request.test.ts`
    - `tests/anthropic-response.test.ts`
    - `tests/create-chat-completions.test.ts`
  - Relevant additions:
    - Add a focused test file for model cache lookup, e.g. `tests/model-cache.test.ts` or `tests/get-models-cache.test.ts`.
    - Add/update request logger tests, e.g. `tests/request-logger.test.ts`, if no existing logger tests exist.
    - Add integration-style route tests only if current test utilities make route invocation/log spying straightforward.

## Minimal Changeset

1. **Expose a cache-only display-name lookup helper**

   In `src/services/copilot/get-models.ts`, add a synchronous helper that reads from the existing in-memory cached models list only:

   ```ts
   export function getCachedModelDisplayName(modelId: string): string | undefined {
     // cache-only lookup
   }
   ```

   Requirements for this helper:

   - Must not call the model-fetching function.
   - Must not perform network I/O.
   - Must return `undefined` when:
     - `modelId` is empty.
     - The cache is empty/uninitialized.
     - No cached model has the requested ID.
     - The cached entry is malformed.
     - `display_name` is missing or not a string.
   - Must not throw for malformed cache contents.

   If the existing cache is an array and model logs are frequent, maintain a derived lookup map:

   ```ts
   const cachedModelDisplayNames = new Map<string, string>();
   ```

   Update that map whenever the cached model list is refreshed.

2. **Keep cache state authoritative**

   Wherever `src/services/copilot/get-models.ts` currently updates the cached models list, also update the display-name lookup structure.

   Example intent:

   ```ts
   cachedModels = models;
   cachedModelDisplayNames.clear();

   for (const model of models) {
     if (
       model &&
       typeof model.id === "string" &&
       typeof model.display_name === "string"
     ) {
       cachedModelDisplayNames.set(model.id, model.display_name);
     }
   }
   ```

   Do not change fetch timing, cache TTL, refresh behavior, or `/models` response semantics.

3. **Enrich request log context in `src/lib/request-logger.ts`**

   Import the cache-only helper:

   ```ts
   import { getCachedModelDisplayName } from "../services/copilot/get-models";
   ```

   In the section where the logger currently includes a model ID, resolve the display name synchronously:

   ```ts
   const modelDisplayName = model
     ? getCachedModelDisplayName(model)
     : undefined;
   ```

   Add the value to existing structured fields or formatted output.

   Recommended structured field name:

   ```ts
   model_display_name
   ```

   Preferred behavior:

   - If a display name is found, log it.
   - If not found, either omit `model_display_name` or set it to `"unknown"`.
   - Be consistent with the current logging style.

   Example structured-log intent:

   ```ts
   {
     ...existingFields,
     model,
     ...(modelDisplayName
       ? { model_display_name: modelDisplayName }
       : { model_display_name: "unknown" }),
   }
   ```

   Or, if existing logs avoid explicit unknown placeholders:

   ```ts
   {
     ...existingFields,
     model,
     ...(modelDisplayName ? { model_display_name: modelDisplayName } : {}),
   }
   ```

4. **Do not make request logging asynchronous**

   `src/lib/request-logger.ts` should remain synchronous unless it is already async everywhere.

   Avoid:

   ```ts
   await getModels()
   ```

   Avoid any helper that refreshes or fetches models during logging.

5. **Preserve existing model ID semantics**

   Review call sites in:

   - `src/routes/chat-completions/handler.ts`
   - `src/routes/messages/handler.ts`
   - `src/routes/embeddings/route.ts`
   - `src/lib/proxy.ts`

   Do not change which model ID is passed to the logger.

   If current logs show the original requested model, enrich that original model ID.

   If current logs show the mapped/effective model, enrich that mapped/effective model ID.

   Do not alter behavior in `src/lib/model-mapping.ts` unless a helper needs to clarify which ID is being logged.

6. **Make lookup failure non-fatal**

   Wrap lookup defensively if the cache implementation can expose malformed data:

   ```ts
   let modelDisplayName: string | undefined;

   try {
     modelDisplayName = model
       ? getCachedModelDisplayName(model)
       : undefined;
   } catch {
     modelDisplayName = undefined;
   }
   ```

   Ideally the helper itself should be safe and not require a try/catch at each call site.

7. **Add tests for the cache lookup helper**

   Add a test file such as:

   - `tests/get-models-cache.test.ts`
   - or `tests/model-cache.test.ts`

   Cover:

   - Known model ID returns its `display_name`.
   - Unknown model ID returns `undefined`.
   - Empty/uninitialized cache returns `undefined`.
   - Malformed cached model entries do not throw.
   - Missing or non-string `display_name` returns `undefined`.

   If the cache has no test-only setter today, add a small internal/test-safe way to seed the cache without invoking network requests. Prefer not to expose broad mutation APIs in production code unless already consistent with the codebase.

8. **Add tests for request logging enrichment**

   Add or update a logger test, for example:

   - `tests/request-logger.test.ts`

   Cover:

   - Log output includes existing model ID and `model_display_name` for a known cached model.
   - Log output still includes model ID for an unknown cached model.
   - Empty cache does not throw.
   - Logging enrichment does not affect request success.

   Use the project’s existing logging style:

   - If logging uses `console.log`, spy on `console.log`.
   - If logging uses a custom logger abstraction, spy on that abstraction.
   - Assert only the additive display-name field/value and existing model ID, not unrelated formatting details.

9. **Optional integration coverage**

   If current tests already invoke route handlers directly, add one route-level test for either:

   - `src/routes/chat-completions/handler.ts`
   - or `src/routes/messages/handler.ts`

   Verify:

   - Request completes successfully.
   - Existing model ID is logged.
   - Cached display name is included when present.

   Keep this test isolated from actual Copilot network calls by using existing mocks.

10. **Validation**

   Run:

   ```bash
   bun test
   bun run lint
   ```

   Confirm no changes to:

   - API responses.
   - Routing behavior.
   - Authentication.
   - Proxy forwarding.
   - Model mapping.
   - Request body handling.
   - Response status codes.
