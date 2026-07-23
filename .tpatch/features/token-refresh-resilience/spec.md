# Specification

## Acceptance criteria

1. Refresh is scheduled from each response's `refresh_in`, not a fixed startup interval.
2. Concurrent refresh requests share one in-flight operation.
3. A failed refresh never replaces the last valid token or throws from a timer callback.
4. Failed refreshes retry with bounded backoff before token expiry.
5. Copilot API requests receiving 401 refresh once and replay once with the new token.
6. Non-401 responses and caller abort signals are not retried.
7. All Copilot model endpoints use the shared authenticated fetch path.
8. Focused tests and `bun test` pass.

## Out of scope

Refreshing the long-lived GitHub credential, unlimited retries, and context/effort behavior.
