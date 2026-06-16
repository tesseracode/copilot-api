# Analysis: api-context-effort-migration

## Summary

Migrate the proxy's context window and effort handling to align with upstream Copilot API changes where Claude 4.6+ models are natively 1M context and effort is sent via output_config.effort in the request body rather than model name suffixes. This requires removing dead suffix-based logic (e.g., -1m, -high, -xhigh normalization) and refactoring effort detection to use advertised reasoning_effort capabilities instead of checking for -1m in model IDs.

## Compatibility

**Status**: conflict

The current codebase contains hardcoded logic that depends on model name suffixes (-1m, -high, -xhigh) for context and effort handling. The upstream API no longer advertises these variants, making the existing normalization and effort detection logic broken. This is a breaking change that requires refactoring core model handling and request transformation logic.

## Affected Areas

- src/lib/model-mapping.ts
- src/lib/model-mapping.test.ts
- src/lib/filter-models.ts
- src/lib/filter-models.test.ts
- src/lib/api-config.ts
- src/routes/messages/
- src/routes/chat-completions/
- src/services/copilot/
- tests/anthropic-request.test.ts
- tests/anthropic-response.test.ts

## Acceptance Criteria

1. Model mapping no longer normalizes max/high/xhigh suffixes to -1m variants for Claude 4.6+
2. Effort parameter is extracted from request body and forwarded via output_config.effort instead of model name
3. supportsEffort() function checks advertised reasoning_effort capabilities instead of -1m suffix presence
4. All Claude 4.6+ models correctly report max_context_window_tokens: 1000000 without suffix variants
5. Existing tests pass with new logic; add tests for effort forwarding via output_config
6. No silent dropping of effort values for opus-4.7+ models
7. Backward compatibility maintained for older Claude models that may still use suffix-based variants

## Implementation Notes

- Identify where model name normalization occurs (likely in model-mapping.ts) and remove suffix-based transformations for 4.6+
- Locate effort detection logic (supportsEffort() function) and refactor to check model capabilities from API response instead of ID patterns
- Find request transformation code that builds the Copilot API request and add output_config.effort field population from parsed effort parameter
- Update filter-models.ts to handle new model variant structure (no -1m, -high, -xhigh suffixes)
- Review all test files to ensure they reflect new API contract; update mock responses to match new model metadata structure
- Consider version-gating: older Claude models may still need suffix handling if they're still supported
- Ensure effort values are properly validated before forwarding (check valid enum values for output_config.effort)

## Unresolved Questions

- What is the exact structure of the advertised reasoning_effort capabilities in the new API response? (e.g., is it a boolean, enum, or object?)
- Are older Claude models (pre-4.6) still supported, and if so, do they still use suffix-based variants or have they been migrated too?
- What are the valid values for output_config.effort in the new API? (e.g., 'low', 'medium', 'high', 'max'?)
- Should the proxy maintain backward compatibility by accepting old-style model names with suffixes and translating them, or should it reject them?
- Are there any other request/response fields affected by this API change that need migration?
- How should the proxy handle requests for non-existent -1m/-high/-xhigh variants after migration?


## Resolved Questions (from manual exploration 2026-06-16)

1. **reasoning_effort structure**: It's an array of strings in `capabilities.supports.reasoning_effort`. E.g. `["low", "medium", "high", "max"]` for opus-4.6, `["low", "medium", "high", "xhigh", "max"]` for opus-4.7/4.8.

2. **Older Claude models**: haiku-4.5, sonnet-4.5, opus-4.5 still exist with `max_context_window_tokens: 200000`. They do NOT have reasoning_effort in capabilities. They still need `thinking: {type: "enabled", budget_tokens: N}` approach. No suffix variants exist for them either.

3. **Valid effort values**: Per model — opus-4.6 accepts `[low, medium, high, max]`, opus-4.7/4.8 accept `[low, medium, high, xhigh, max]`. Sending unsupported values (e.g. `xhigh` to opus-4.6) causes HTTP 400: `"output_config.effort \"xhigh\" is not supported by model claude-opus-4.6; supported values: [low medium high max]"`.

4. **Backward compat for [1m] suffix**: Keep stripping it (Claude Code sends it), just don't try to resolve to a -1m variant. Treat it as a no-op since all 4.6+ are already 1M.

5. **Other affected fields**: GPT-5.x effort should go via `reasoning: {effort: "..."}` in the /responses payload. The type exists (`ResponsesPayload.reasoning`) but is never populated.

6. **Non-existent variants**: Already handled gracefully — `anthropicToCopilotModelId()` falls back to base model when variant not in catalog.
