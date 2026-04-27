# Analysis: hide-internal-models

## Summary

Add a --hide-internal CLI flag to the proxy server that, when enabled, filters out models from the /models endpoint response whose ID contains the substring 'internal' or starts with 'accounts/'. This allows users to hide implementation-internal or account-scoped models from downstream clients.

## Compatibility

**Status**: compatible

This is a purely additive feature: a new opt-in CLI flag and a filter applied to an existing route. It does not change existing behavior when the flag is absent.

## Affected Areas

- src/main.ts
- src/start.ts
- src/lib/state.ts
- src/routes/models/

## Acceptance Criteria

1. Running without --hide-internal returns all models unchanged.
2. Running with --hide-internal excludes any model whose id contains 'internal' (case-sensitive).
3. Running with --hide-internal excludes any model whose id starts with 'accounts/'.
4. The flag is documented in --help output.
5. A test covers both the filtered and unfiltered cases for the /models route.

## Implementation Notes

- Parse --hide-internal boolean flag in src/main.ts or src/start.ts using the existing CLI arg parsing pattern.
- Store the flag value in the shared state object in src/lib/state.ts so it is accessible to route handlers.
- In the models route handler (src/routes/models/), after fetching the model list, apply a filter: model.id.includes('internal') || model.id.startsWith('accounts/') when hideInternal is true.
- Keep the filter logic in a small, pure utility function for testability.

## Unresolved Questions

- Should the filter be case-insensitive for 'internal'?
- Should the flag also be configurable via an environment variable (e.g., HIDE_INTERNAL_MODELS=true)?
- Does the filter apply only to the /models listing or also to validation elsewhere (e.g., model routing in src/lib/endpoint-routing.ts)?

