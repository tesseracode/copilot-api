# Analysis: health-endpoint

## Summary

Add a GET /health endpoint that returns JSON containing server health metrics including uptime in seconds, the count of available models, and the server version read from package.json. This endpoint will provide operational visibility into the server state.

## Compatibility

**Status**: compatible

The feature is a new endpoint addition that doesn't conflict with existing routing patterns. The project already has route organization in src/routes/ and endpoint-routing infrastructure. Reading package.json version and tracking uptime are standard non-invasive operations. No breaking changes to existing functionality.

## Affected Areas

- src/routes/ (new route handler needed)
- src/lib/endpoint-routing.ts (route registration)
- src/server.ts (uptime tracking initialization)
- src/main.ts (server startup/state management)
- package.json (version source)
- tests/ (new test file for health endpoint)

## Acceptance Criteria

1. GET /health endpoint responds with HTTP 200 and JSON content-type
2. Response includes 'uptime' field with value in seconds (numeric)
3. Response includes 'modelCount' field with accurate count of available models
4. Response includes 'version' field matching the version in package.json
5. 'uptime' value increases over time and resets when server restarts
6. 'modelCount' reflects the actual models available (check src/routes/models/ for current logic)
7. Endpoint works consistently across dev and prod builds
8. Unit tests verify response structure and field types
9. Integration test verifies endpoint is reachable and returns valid data

## Implementation Notes

- Track server startup time globally in src/main.ts or src/server.ts to calculate uptime
- Model count should reference the existing model mapping/listing logic - likely in src/lib/model-mapping.ts or src/routes/models/
- Read package.json version using import or fs at startup and cache it (don't read on every request)
- Follow project's error handling patterns using src/lib/error.ts if needed
- Place endpoint handler in src/routes/health/ directory following existing route organization
- Use absolute imports with ~/* alias per project standards
- Register route in src/lib/endpoint-routing.ts
- Ensure response follows consistent JSON formatting with other endpoints
- No authentication required based on typical health endpoint patterns (verify with team if needed)

## Unresolved Questions

- Should the /health endpoint require authentication or be publicly accessible?
- Where is the model count currently calculated - should we reference src/routes/models/ or src/lib/model-mapping.ts?
- Should uptime tracking be stored in global state (src/lib/state.ts) or in server/main module?
- Are there any monitoring/observability systems this endpoint should integrate with?
- Should additional health metrics be included (e.g., request count, error rate, memory usage)?
- Should the endpoint follow any specific OpenAPI/swagger specification?

