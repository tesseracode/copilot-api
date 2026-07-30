# Mutation test evidence

## Pre-implementation red gate

```sh
bun test tests/responses-instruction-role-preservation.test.ts
```

Result against unchanged production: system-only, mixed-role, and routed upstream-body assertions failed because every system message became developer. Developer-only preservation passed.

## Mutations

1. Replaced `role: msg.role` with `role: "developer"`.
   - Pure system and route-capture tests failed with developer instead of system.
2. Reversed message iteration order.
   - Mixed system/developer/user order assertion failed at every high-authority boundary.
3. Removed `system` from the Responses input role union.
   - `bun run typecheck` failed at translator assignment and exact expected payloads.
4. Routed upstream capture is included in mutation 1 and failed independently from the pure helper assertion.
5. A live provider matrix confirmed Responses-routed GPT-5.6, GPT-5 mini and MAI accept preserved roles; Chat-routed Gemini/GPT-4.1 bypass this translator; Claude exposes a separate developer-instruction gap.

Each exact hunk was restored after the expected failure.
