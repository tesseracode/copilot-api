# Specification

## Problem

Malformed replay history can forward empty Responses tool correlation IDs and receive an opaque upstream 400.

## Acceptance criteria

1. Assistant tool calls with an empty or missing ID fail locally with HTTP 400.
2. Tool-result messages with an empty or missing `tool_call_id` fail locally with HTTP 400.
3. Valid tool replay preserves the same non-empty value in `function_call.call_id` and `function_call_output.call_id`.
4. Valid translated input does not synthesize an empty Responses item `id`.
5. `bun test tests/responses-effort-forwarding.test.ts tests/messages-tool-result-validation.test.ts` passes.
6. The model validation suite contains end-to-end malformed-ID probes.

## Out of scope

Generating replacement IDs for malformed caller history, changing streaming output IDs, or modifying Claude-native tool validation.
