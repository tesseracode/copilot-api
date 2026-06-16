# Feature Request: Add unit tests for the api-context-effort-migration feature gaps: (1) buildNativeBody extracts effort from legacy model-name suffixes like claude-opus-4-7-xhigh, (2) translateRequestToResponses populates reasoning.effort for GPT-5.x, (3) anthropicToCopilotModelId strips -1m dash suffix (not just [1m] bracket suffix).

**Slug**: `api-migration-test-coverage`
**Created**: 2026-06-16T19:58:55Z

## Description

Add unit tests for the api-context-effort-migration feature gaps: (1) buildNativeBody extracts effort from legacy model-name suffixes like claude-opus-4-7-xhigh, (2) translateRequestToResponses populates reasoning.effort for GPT-5.x, (3) anthropicToCopilotModelId strips -1m dash suffix (not just [1m] bracket suffix).
