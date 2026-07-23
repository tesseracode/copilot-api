# Specification

## Acceptance criteria

1. Default execution is dry-run and sends no model requests.
2. One selected model is tested for control, prompt overflow, combined overflow, and output overflow.
3. Direct and proxy outcomes are captured and classified independently.
4. Reports include catalog limits, local estimates, status/errors, provider usage, request IDs, and duration.
5. `/usage` credit snapshots and observed delta are recorded without claiming a token conversion formula.
6. Impossible catalog geometries are marked not applicable.
7. JSON and Markdown reports are reproducible under `scripts/reports/context-boundary/`.
8. `bun test tests/context-boundary-validation.test.ts` passes.

## Out of scope

Automatic request truncation, harness compaction, catalog-wide stress tests, and the separate token-refresh incident.
