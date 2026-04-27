# Specification: log-model-display-name

## Acceptance Criteria

1. Request log lines that currently include a model ID also include the model’s human-readable `display_name` when that model ID exists in the cached models list.

2. The display name is resolved from the existing cached models list only.

3. The implementation does not trigger a network request solely to enrich request logs with `display_name`.

4. If the model ID is not found in the cached models list, the request log line still includes the model ID and handles the display name safely by either:
   - omitting the display name field, or
   - logging a clear fallback value such as `unknown`.

5. If the cached models list is empty, unavailable, stale, or malformed, request handling continues normally and logging does not throw.

6. Existing request behavior remains unchanged, including:
   - routing
   - model selection
   - authentication
   - proxy behavior
   - API responses
   - status codes
   - request/response body handling

7. Existing logging behavior remains otherwise unchanged, including:
   - log levels
   - timing
   - request identifiers
   - existing model ID output
   - existing structured log fields or message format, except for the additive display name field/value

8. Display name lookup is efficient and does not perform repeated expensive scans if a cached map or equivalent lookup structure is appropriate.

9. The request logger does not become asynchronous unless all existing call sites already support asynchronous logging safely.

10. Automated tests cover:
    - a known model ID where `display_name` is found
    - an unknown model ID where no cached model exists
    - an empty or unavailable cached models list
    - verification that logging enrichment does not affect request success

11. The project passes:

    ```bash
    bun test
    bun run lint
    ```

## Implementation Plan

1. Inspect the current request logging flow.

   - Review `src/lib/request-logger.ts`.
   - Identify all log lines that include a model ID.
   - Determine whether logs are structured objects, formatted strings, or both.
   - Identify call sites in likely affected areas:
     - `src/routes/chat-completions/`
     - `src/routes/messages/`
     - `src/lib/proxy.ts`

2. Locate the existing cached models implementation.

   - Review:
     - `src/routes/models/`
     - `src/services/copilot/`
     - any existing model cache or model-fetching utilities
   - Identify the cached model shape and confirm the presence of:
     - `id`
     - `display_name`

3. Add or reuse a synchronous cached model lookup helper.

   Prefer a small helper with an interface similar to:

   ```ts
   export function getCachedModelDisplayName(modelId: string): string | undefined
   ```

   Requirements for the helper:

   - Reads only from the existing in-memory cached models list.
   - Does not fetch or refresh models.
   - Returns `undefined` if:
     - the cache is empty
     - the model ID is not present
     - the cached entry is malformed
     - `display_name` is missing or invalid
   - Does not throw during normal malformed-cache scenarios.

4. Keep the lookup decoupled from route-specific code.

   - Avoid importing route handlers directly into `request-logger.ts`.
   - If needed, move cache access into a shared module such as:
     - `src/lib/model-cache.ts`
     - `src/services/copilot/models-cache.ts`
     - or an existing equivalent shared service module

5. Consider adding an efficient cached map.

   If the cached models list is an array and request logging happens frequently, maintain or derive a map:

   ```ts
   Map<string, string>
   ```

   from:

   ```ts
   model.id -> model.display_name
   ```

   Ensure the map is updated whenever the cached models list is refreshed.

6. Decide the exact log field name and fallback behavior.

   Recommended structured field names:

   ```ts
   model: "gpt-4.1"
   model_display_name: "GPT-4.1"
   ```

   Recommended fallback behavior:

   - Keep logging the model ID.
   - Use `model_display_name: "unknown"` if the logging style favors explicit fields.
   - Or omit `model_display_name` if existing logs avoid unknown placeholders.

   Apply the choice consistently across all affected request logs.

7. Update `src/lib/request-logger.ts`.

   - When a model ID is present, resolve the display name using the cached lookup helper.
   - Add the display name to the log context or formatted message.
   - Ensure failures in lookup cannot break logging or request handling.

   Example intent:

   ```ts
   const modelDisplayName = modelId
     ? getCachedModelDisplayName(modelId)
     : undefined;
   ```

8. Handle model mapping carefully.

   - Review `src/lib/model-mapping.ts`.
   - Determine whether current logs show:
     - the originally requested model ID
     - the mapped/effective model ID
     - both
   - Enrich the display name for the same model ID that is currently logged.
   - Do not change which model ID is logged unless explicitly required.

9. Add unit tests for the lookup helper.

   Cover:

   - returns display name for known model ID
   - returns `undefined` for unknown model ID
   - returns `undefined` for missing `display_name`
   - returns `undefined` or safely handles malformed cache entries
   - does not initiate model fetching/network activity

10. Add or update request logger tests.

   Cover:

   - known model logs include both model ID and display name
   - unknown model logs still include model ID and use the agreed fallback behavior
   - empty cache does not throw
   - malformed cache does not throw

   Use existing logger test patterns. If none exist, spy on the logging abstraction or console output.

11. Add integration-style tests if current test structure supports them.

   For chat completions/messages requests, verify:

   - request succeeds
   - log contains model ID
   - log contains display name when cache contains the model

12. Run validation.

   ```bash
   bun test
   bun run lint
   ```

13. Review for compatibility.

   Confirm the change does not:

   - alter API responses
   - alter model routing
   - introduce async logging where sync logging was expected
   - introduce new network calls during request handling
   - throw when cache state is invalid
   - expose unexpected sensitive information in logs
