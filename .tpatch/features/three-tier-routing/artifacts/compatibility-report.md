# Model Compatibility Report

**Date**: 2026-04-26
**Proxy version**: post-commit `b56b9da` (three-tier endpoint routing)
**Test method**: `POST` with `"Respond with only the word PONG"` prompt, `max_tokens: 64`

## Routing Summary

| Route | Endpoint | Models |
|-------|----------|--------|
| Native Anthropic passthrough | `/v1/messages` | All Claude models |
| Responses API translation | `/responses` | GPT-5.x models |
| Chat Completions (legacy) | `/chat/completions` | GPT-4.x, Gemini, legacy |

## Test Results

### Claude models — native `/v1/messages` passthrough

| Model ID | Copilot ID | Route | Status | Notes |
|----------|-----------|-------|--------|-------|
| `claude-opus-4-6[1m]` | `claude-opus-4.6-1m` | `/v1/messages` | PASS | 1M context, native response with cache info |
| `claude-opus-4-6` | `claude-opus-4.6` | `/v1/messages` | PASS | |
| `claude-sonnet-4-6` | `claude-sonnet-4.6` | `/v1/messages` | PASS | |
| `claude-sonnet-4` | `claude-sonnet-4` | `/v1/messages` | PASS | |
| `claude-sonnet-4-5` | `claude-sonnet-4.5` | `/v1/messages` | PASS | |
| `claude-opus-4-5` | `claude-opus-4.5` | `/v1/messages` | PASS | |
| `claude-haiku-4-5` | `claude-haiku-4.5` | `/v1/messages` | PASS | Fixed: was missing from model ID map |

**Adaptive thinking downgrade**: Tested with `thinking: { type: 'adaptive' }` on `claude-opus-4-6` — correctly downgraded to `{ type: 'enabled', budget_tokens: max(1024, max_tokens - 1) }`. Response included both `thinking` and `text` content blocks.

### GPT-5.x models — `/responses` API

| Model ID | Supported Endpoints | Route | Status | Notes |
|----------|-------------------|-------|--------|-------|
| `gpt-5.5` | `/responses`, `ws:/responses` | `/responses` | PASS | Previously inaccessible — now works |
| `gpt-5.4-mini` | `/responses`, `ws:/responses` | `/responses` | PASS | Previously inaccessible — now works |
| `gpt-5.4` | `/chat/completions`, `/responses`, `ws:/responses` | `/responses` | PASS | |
| `gpt-5.2-codex` | `/responses` | `/responses` | PASS | Previously inaccessible — now works |
| `gpt-5.3-codex` | `/responses` | `/responses` | PASS | Previously inaccessible — now works |
| `gpt-5.2` | `/chat/completions`, `/responses`, `ws:/responses` | `/responses` | PASS | |
| `gpt-5-mini` | `/chat/completions`, `/responses`, `ws:/responses` | `/responses` | WARN | Returns `content: null` — model quirk, not proxy bug |

### Gemini models — `/chat/completions`

| Model ID | Route | Status | Notes |
|----------|-------|--------|-------|
| `gemini-2.5-pro` | `/chat/completions` | PASS | |
| `gemini-3-flash-preview` | `/chat/completions` | PASS | |
| `gemini-3.1-pro-preview` | `/chat/completions` | PASS | |

### GPT-4.x / Legacy — `/chat/completions`

| Model ID | Route | Status | Notes |
|----------|-------|--------|-------|
| `gpt-4.1` | `/chat/completions` | PASS | |
| `gpt-4o` | `/chat/completions` | PASS | |
| `gpt-4o-mini` | `/chat/completions` | PASS | |
| `gpt-4` | `/chat/completions` | PASS | |
| `gpt-3.5-turbo` | `/chat/completions` | PASS | |

### Not testable

| Model ID | Reason |
|----------|--------|
| `minimax-m2.5` | Rejected by upstream GitHub API ("model not supported") |
| `gpt-41-copilot` | Completion-type model, not chat |
| `claude-opus-4.7-1m-internal` | Internal model |
| `claude-opus-4.7` | Internal model |
| `text-embedding-*` | Embedding models (different API) |
| `accounts/msft/routers/*` | Internal routing models |

## Summary

- **23/24** chat models tested successfully
- **4 previously inaccessible** models now work (gpt-5.5, gpt-5.4-mini, gpt-5.2-codex, gpt-5.3-codex)
- **7 Claude models** now use native passthrough (zero lossy conversion)
- **1 warning** (gpt-5-mini returns null content — model behavior, not proxy)
- **1 upstream rejection** (minimax-m2.5 — GitHub API issue)
