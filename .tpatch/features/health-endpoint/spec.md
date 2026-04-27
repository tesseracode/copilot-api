# Specification: health-endpoint

# Health Endpoint Feature Implementation

## Acceptance Criteria

1. GET /health endpoint responds with HTTP 200 status code and application/json content-type header
2. Response JSON includes 'uptime' field containing the server uptime as a positive numeric value in seconds
3. Response JSON includes 'modelCount' field containing an integer representing the total number of available models
4. Response JSON includes 'version' field containing a string that exactly matches the version specified in package.json
5. The 'uptime' value accurately increases over time as the server runs and resets to 0 (or near 0) following server restart
6. The 'modelCount' value reflects the actual count of models available through the existing model routing/mapping system
7. Endpoint functions consistently in both development and production build environments
8. Unit tests verify the response structure contains all three required fields with correct data types
9. Unit tests verify the 'version' field is correctly read from package.json at startup
10. Integration test verifies the endpoint is reachable at GET /health and returns valid JSON data
11. Integration test verifies the 'uptime' value increases between consecutive requests
12. Endpoint is publicly accessible without authentication requirements

## Implementation Plan

### Phase 1: Setup and Infrastructure (1-2 hours)

1. **Create uptime tracking module** (`src/lib/uptime.ts`)
   - Export a function to initialize uptime tracking at server startup
   - Store startup timestamp in module scope
   - Export a function to calculate current uptime in seconds
   - Ensure thread-safe and performant calculations

2. **Create version loader module** (`src/lib/version.ts`)
   - Read version from package.json at module initialization
   - Cache the version string in module scope
   - Export a function to retrieve the cached version
   - Handle potential file-not-found errors gracefully with fallback ("unknown")

3. **Identify model counting logic**
   - Audit `src/routes/models/` and `src/lib/model-mapping.ts` to locate existing model enumeration
   - Create or export a helper function in `src/lib/model-counter.ts` that returns the count of available models
   - Document the source of truth for model availability

### Phase 2: Endpoint Implementation (2-3 hours)

1. **Create health route handler** (`src/routes/health/index.ts`)
   - Import uptime tracker, version loader, and model counter
   - Create route handler function for GET /health
   - Construct JSON response object with three fields: `uptime`, `modelCount`, `version`
   - Return response with HTTP 200 status and application/json content-type
   - Follow project's existing endpoint handler patterns and error handling

2. **Register route in endpoint routing** (`src/lib/endpoint-routing.ts`)
   - Add GET /health route registration using project's routing framework
   - Ensure route is placed in correct priority order relative to other routes
   - Verify no conflicting routes exist

3. **Initialize uptime tracking at server startup** (`src/main.ts` or `src/server.ts`)
   - Call uptime initialization function when server starts
   - Ensure initialization happens before route registration
   - Verify no race conditions with route handler access

### Phase 3: Testing (2-3 hours)

1. **Create unit tests** (`tests/health.unit.test.ts`)
   - Test uptime calculation returns numeric value greater than or equal to 0
   - Test uptime calculation increases between successive calls
   - Test version loader correctly reads and caches version from package.json
   - Test model counter returns valid non-negative integer
   - Mock dependencies to isolate health endpoint logic

2. **Create integration tests** (`tests/health.integration.test.ts`)
   - Test GET /health returns HTTP 200 status code
   - Test response content-type is application/json
   - Test response JSON structure contains all three required fields
   - Test response field types: uptime (number), modelCount (number), version (string)
   - Test uptime value increases across multiple requests with delays
   - Test response is consistent across multiple rapid requests

3. **Manual verification**
   - Start server and verify endpoint is reachable
   - Use curl/Postman to test response format in both dev and prod environments
   - Verify uptime increments as expected
   - Restart server and confirm uptime resets

### Phase 4: Documentation and Cleanup (1 hour)

1. **Update API documentation**
   - Document GET /health endpoint with description, response schema, example
   - Add endpoint to API specification/OpenAPI if applicable

2. **Code review checklist**
   - Verify absolute imports use `~/` alias convention
   - Confirm error handling follows project patterns
   - Check response JSON formatting matches other endpoints
   - Validate no sensitive information exposed in response

3. **Resolve unresolved questions**
   - Confirm authentication is not required (or add if needed)
   - Verify chosen model count source is appropriate
   - Document uptime tracking implementation location
   - Decide if additional metrics should be deferred to future enhancement

### Technology Stack & Conventions

- **Language**: Use project's existing language (TypeScript/JavaScript)
- **Testing**: Use project's test framework (Jest/Vitest/Mocha)
- **Import style**: Absolute imports with `~/` alias
- **Response format**: Consistent with existing endpoints (likely Express.js JSON responses)
- **Error handling**: Reference `src/lib/error.ts` patterns

### Success Criteria for Completion

- ✅ All acceptance criteria pass
- ✅ Unit test coverage ≥ 90% for health module
- ✅ Integration tests pass in CI/CD pipeline
- ✅ No breaking changes to existing endpoints
- ✅ Code review approved
- ✅ Documentation updated
