# Feature Request: Migrate 1M context and effort handling after upstream API changes: the Copilot API no longer advertises separate -1m, -high, or -xhigh model variants. All Claude 4.6+ models are natively 1M context (max_context_window_tokens: 1000000). Effort is now sent via output_config.effort in the request body (not model name suffixes). Current proxy code is broken: max→xhigh normalization fails for opus-4.6, and opus-4.7+ effort is silently dropped because supportsEffort() checks for -1m in the ID. Need to remove dead suffix logic and forward output_config.effort directly using advertised reasoning_effort capabilities.

**Slug**: `api-context-effort-migration`
**Created**: 2026-06-16T16:55:42Z

## Description

Migrate 1M context and effort handling after upstream API changes: the Copilot API no longer advertises separate -1m, -high, or -xhigh model variants. All Claude 4.6+ models are natively 1M context (max_context_window_tokens: 1000000). Effort is now sent via output_config.effort in the request body (not model name suffixes). Current proxy code is broken: max→xhigh normalization fails for opus-4.6, and opus-4.7+ effort is silently dropped because supportsEffort() checks for -1m in the ID. Need to remove dead suffix logic and forward output_config.effort directly using advertised reasoning_effort capabilities.
