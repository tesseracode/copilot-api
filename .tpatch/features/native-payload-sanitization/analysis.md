# Analysis: native-payload-sanitization

## Summary

The `/v1/messages` passthrough (introduced by `three-tier-routing`) forwards Anthropic-format payloads to Copilot's native endpoint. Two fields cause 400 errors because Copilot's endpoint is stricter than the first-party Anthropic API:

1. **Whitespace-only `stop_sequences`** — Buddy sends `['\n']` via `smartFallbackReaction()`. Anthropic accepts it; Copilot rejects with `"each stop sequence must contain non-whitespace"`.
2. **`output_config`** — Claude Code sends `{ effort, task_budget, format }` on every main-loop query. Copilot rejects with `"output_config: Extra inputs are not permitted"`. The allowlist in `buildNativeBody()` already drops this field, but the `effort` signal is lost entirely.

## Upstream Status

Not present upstream. This is a proxy-layer concern — the upstream Copilot API is the one rejecting these fields, so the fix must live in our proxy.

## Compatibility

- **No breaking changes.** Both fixes are additive sanitizations at the proxy boundary.
- **stop_sequences fix:** Only removes entries that would cause a 400 anyway. Valid sequences pass through unchanged.
- **effort mapping:** Lossy approximation — first-party effort also affects non-thinking behavior, adaptive thinking dynamically scales, and `max` triggers special model behavior. Our mapping (effort → static thinking budget) is the best available approximation given Copilot's constraints.
- **Dependency:** Requires `three-tier-routing` (applied) — the `/v1/messages` passthrough path must exist.

## Risks

- **Low:** stop_sequences stripping is purely defensive.
- **Low-medium:** effort mapping produces different behavior than first-party. Users expecting exact first-party semantics may notice differences in reasoning depth. However, this is strictly better than the current state (effort signal dropped entirely).

## Files Affected

- `src/routes/messages/anthropic-types.ts` — add `output_config` to payload type
- `src/services/copilot/forward-native-messages.ts` — sanitize stop_sequences, map effort to thinking budget in `buildNativeBody()`
