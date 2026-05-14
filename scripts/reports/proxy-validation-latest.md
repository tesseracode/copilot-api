# Proxy Model Validation Report — 2026-05-14

## Summary
- Models discovered: 43
- Models tested: 34
- Tests: 102 smoke + 6 translation + 0 capability = 108 total
- Smoke: 90 ok, 2 proxy bugs, 10 upstream limitations
- Translation: 5/6 pass
- Capability: 0/0 pass

## Model Profiles

| Model | Endpoint | Tools | Thinking | Effort | Temp | Max Output |
|-------|----------|-------|----------|--------|------|------------|
| claude-opus-4.6-1m | /v1/messages | ✅ | adaptive | param | ✅ | 64000 |
| claude-opus-4.6 | /v1/messages | ✅ | adaptive | param | ✅ | 32000 |
| claude-opus-4.7 | /v1/messages | ✅ | adaptive | suffix | ✅ | 32000 |
| claude-sonnet-4.6 | /v1/messages | ✅ | adaptive | param | ✅ | 32000 |
| gemini-3.1-pro-preview | /chat/completions | ✅ | none | none | ✅ | 64000 |
| gpt-5.2-codex | /responses | ✅ | none | none | ❌ | 128000 |
| gpt-5.3-codex | /responses | ✅ | none | none | ❌ | 128000 |
| gpt-5.4-mini | /responses | ✅ | none | none | ❌ | 128000 |
| gpt-5.4 | /responses | ✅ | none | none | ❌ | 128000 |
| gpt-5.5 | /responses | ✅ | none | none | ❌ | 128000 |
| gpt-5-mini | /responses | ✅ | none | none | ❌ | 64000 |
| gpt-4o-mini-2024-07-18 | /chat/completions | ✅ | none | none | ✅ | 4096 |
| gpt-4o-2024-11-20 | /chat/completions | ✅ | none | none | ✅ | 16384 |
| gpt-4o-2024-08-06 | /chat/completions | ✅ | none | none | ✅ | 16384 |
| claude-sonnet-4.5 | /v1/messages | ✅ | enabled-only | none | ✅ | 32000 |
| claude-opus-4.5 | /v1/messages | ✅ | enabled-only | none | ✅ | 32000 |
| claude-haiku-4.5 | /v1/messages | ✅ | enabled-only | none | ✅ | 64000 |
| gemini-3-flash-preview | /chat/completions | ✅ | none | none | ✅ | 64000 |
| gemini-2.5-pro | /chat/completions | ✅ | none | none | ✅ | 64000 |
| gpt-4.1-2025-04-14 | /chat/completions | ✅ | none | none | ✅ | 16384 |
| gpt-5.2 | /responses | ✅ | none | none | ❌ | 128000 |
| gpt-41-copilot | /chat/completions | ✅ | none | none | ✅ | 4096 |
| gpt-3.5-turbo-0613 | /chat/completions | ✅ | none | none | ✅ | 4096 |
| gpt-4 | /chat/completions | ✅ | none | none | ✅ | 4096 |
| gpt-4-0613 | /chat/completions | ✅ | none | none | ✅ | 4096 |
| gpt-4-0125-preview | /chat/completions | ✅ | none | none | ✅ | 4096 |
| gpt-4o-2024-05-13 | /chat/completions | ✅ | none | none | ✅ | 4096 |
| gpt-4-o-preview | /chat/completions | ✅ | none | none | ✅ | 4096 |
| gpt-4.1 | /chat/completions | ✅ | none | none | ✅ | 16384 |
| gpt-3.5-turbo | /chat/completions | ✅ | none | none | ✅ | 4096 |
| gpt-4o-mini | /chat/completions | ✅ | none | none | ✅ | 4096 |
| gpt-4 | /chat/completions | ✅ | none | none | ✅ | 4096 |
| gpt-4o | /chat/completions | ✅ | none | none | ✅ | 4096 |
| gpt-4-o-preview | /chat/completions | ✅ | none | none | ✅ | 4096 |

## Smoke Tests

| Model | Test | Direct | Proxy /msg | Proxy /chat | Blame |
|-------|------|--------|-----------|-------------|-------|
| claude-opus-4.6-1m | text | ✅ | ✅ | ✅ | ✅ ok |
| claude-opus-4.6-1m | tools | ✅ | ✅ | ✅ | ✅ ok |
| claude-opus-4.6-1m | stream | ✅ | ✅ | ✅ | ✅ ok |
| claude-opus-4.6 | text | ✅ | ✅ | ✅ | ✅ ok |
| claude-opus-4.6 | tools | ✅ | ✅ | ✅ | ✅ ok |
| claude-opus-4.6 | stream | ✅ | ✅ | ✅ | ✅ ok |
| claude-opus-4.7 | text | ✅ | ✅ | ✅ | ✅ ok |
| claude-opus-4.7 | tools | ✅ | ✅ | ✅ | ✅ ok |
| claude-opus-4.7 | stream | ✅ | ✅ | ✅ | ✅ ok |
| claude-sonnet-4.6 | text | ✅ | ✅ | ✅ | ✅ ok |
| claude-sonnet-4.6 | tools | ✅ | ✅ | ❌ | 🐛 proxy-bug |
| claude-sonnet-4.6 | stream | ✅ | ✅ | ✅ | ✅ ok |
| gemini-3.1-pro-preview | text | ❌ | ❌ | ❌ | ⚠️ upstream |
| gemini-3.1-pro-preview | tools | ✅ | ✅ | ❌ | 🐛 proxy-bug |
| gemini-3.1-pro-preview | stream | ✅ | ✅ | ✅ | ✅ ok |
| gpt-5.2-codex | text | ✅ | ✅ | ✅ | ✅ ok |
| gpt-5.2-codex | tools | ✅ | ✅ | ✅ | ✅ ok |
| gpt-5.2-codex | stream | ✅ | ✅ | ✅ | ✅ ok |
| gpt-5.3-codex | text | ✅ | ✅ | ✅ | ✅ ok |
| gpt-5.3-codex | tools | ✅ | ✅ | ✅ | ✅ ok |
| gpt-5.3-codex | stream | ✅ | ✅ | ✅ | ✅ ok |
| gpt-5.4-mini | text | ✅ | ✅ | ✅ | ✅ ok |
| gpt-5.4-mini | tools | ✅ | ✅ | ✅ | ✅ ok |
| gpt-5.4-mini | stream | ✅ | ✅ | ✅ | ✅ ok |
| gpt-5.4 | text | ❌ | ❌ | ❌ | ⚠️ upstream |
| gpt-5.4 | tools | ✅ | ✅ | ✅ | ✅ ok |
| gpt-5.4 | stream | ✅ | ✅ | ✅ | ✅ ok |
| gpt-5.5 | text | ❌ | ✅ | ✅ | 🤔 proxy-fix |
| gpt-5.5 | tools | ✅ | ✅ | ✅ | ✅ ok |
| gpt-5.5 | stream | ✅ | ✅ | ✅ | ✅ ok |
| gpt-5-mini | text | ❌ | ❌ | ❌ | ⚠️ upstream |
| gpt-5-mini | tools | ❌ | ❌ | ❌ | ⚠️ upstream |
| gpt-5-mini | stream | ✅ | ✅ | ✅ | ✅ ok |
| gpt-4o-mini-2024-07-18 | text | ✅ | ✅ | ✅ | ✅ ok |
| gpt-4o-mini-2024-07-18 | tools | ✅ | ✅ | ✅ | ✅ ok |
| gpt-4o-mini-2024-07-18 | stream | ✅ | ✅ | ✅ | ✅ ok |
| gpt-4o-2024-11-20 | text | ✅ | ✅ | ✅ | ✅ ok |
| gpt-4o-2024-11-20 | tools | ✅ | ✅ | ✅ | ✅ ok |
| gpt-4o-2024-11-20 | stream | ✅ | ✅ | ✅ | ✅ ok |
| gpt-4o-2024-08-06 | text | ✅ | ✅ | ✅ | ✅ ok |
| gpt-4o-2024-08-06 | tools | ✅ | ✅ | ✅ | ✅ ok |
| gpt-4o-2024-08-06 | stream | ✅ | ✅ | ✅ | ✅ ok |
| claude-sonnet-4.5 | text | ✅ | ✅ | ✅ | ✅ ok |
| claude-sonnet-4.5 | tools | ✅ | ✅ | ✅ | ✅ ok |
| claude-sonnet-4.5 | stream | ✅ | ✅ | ✅ | ✅ ok |
| claude-opus-4.5 | text | ✅ | ✅ | ✅ | ✅ ok |
| claude-opus-4.5 | tools | ✅ | ✅ | ✅ | ✅ ok |
| claude-opus-4.5 | stream | ✅ | ✅ | ✅ | ✅ ok |
| claude-haiku-4.5 | text | ✅ | ✅ | ✅ | ✅ ok |
| claude-haiku-4.5 | tools | ✅ | ✅ | ✅ | ✅ ok |
| claude-haiku-4.5 | stream | ✅ | ✅ | ✅ | ✅ ok |
| gemini-3-flash-preview | text | ❌ | ❌ | ❌ | ⚠️ upstream |
| gemini-3-flash-preview | tools | ✅ | ✅ | ✅ | ✅ ok |
| gemini-3-flash-preview | stream | ✅ | ✅ | ✅ | ✅ ok |
| gemini-2.5-pro | text | ❌ | ❌ | ❌ | ⚠️ upstream |
| gemini-2.5-pro | tools | ❌ | ❌ | ❌ | ⚠️ upstream |
| gemini-2.5-pro | stream | ✅ | ✅ | ✅ | ✅ ok |
| gpt-4.1-2025-04-14 | text | ✅ | ✅ | ✅ | ✅ ok |
| gpt-4.1-2025-04-14 | tools | ✅ | ✅ | ✅ | ✅ ok |
| gpt-4.1-2025-04-14 | stream | ✅ | ✅ | ✅ | ✅ ok |
| gpt-5.2 | text | ✅ | ✅ | ✅ | ✅ ok |
| gpt-5.2 | tools | ✅ | ✅ | ✅ | ✅ ok |
| gpt-5.2 | stream | ✅ | ✅ | ✅ | ✅ ok |
| gpt-41-copilot | text | ❌ | ❌ | ❌ | ⚠️ upstream |
| gpt-41-copilot | tools | ❌ | ❌ | ❌ | ⚠️ upstream |
| gpt-41-copilot | stream | ❌ | ❌ | ❌ | ⚠️ upstream |
| gpt-3.5-turbo-0613 | text | ✅ | ✅ | ✅ | ✅ ok |
| gpt-3.5-turbo-0613 | tools | ✅ | ✅ | ✅ | ✅ ok |
| gpt-3.5-turbo-0613 | stream | ✅ | ✅ | ✅ | ✅ ok |
| gpt-4 | text | ✅ | ✅ | ✅ | ✅ ok |
| gpt-4 | tools | ✅ | ✅ | ✅ | ✅ ok |
| gpt-4 | stream | ✅ | ✅ | ✅ | ✅ ok |
| gpt-4-0613 | text | ✅ | ✅ | ✅ | ✅ ok |
| gpt-4-0613 | tools | ✅ | ✅ | ✅ | ✅ ok |
| gpt-4-0613 | stream | ✅ | ✅ | ✅ | ✅ ok |
| gpt-4-0125-preview | text | ✅ | ✅ | ✅ | ✅ ok |
| gpt-4-0125-preview | tools | ✅ | ✅ | ✅ | ✅ ok |
| gpt-4-0125-preview | stream | ✅ | ✅ | ✅ | ✅ ok |
| gpt-4o-2024-05-13 | text | ✅ | ✅ | ✅ | ✅ ok |
| gpt-4o-2024-05-13 | tools | ✅ | ✅ | ✅ | ✅ ok |
| gpt-4o-2024-05-13 | stream | ✅ | ✅ | ✅ | ✅ ok |
| gpt-4-o-preview | text | ✅ | ✅ | ✅ | ✅ ok |
| gpt-4-o-preview | tools | ✅ | ✅ | ✅ | ✅ ok |
| gpt-4-o-preview | stream | ✅ | ✅ | ✅ | ✅ ok |
| gpt-4.1 | text | ✅ | ✅ | ✅ | ✅ ok |
| gpt-4.1 | tools | ✅ | ✅ | ✅ | ✅ ok |
| gpt-4.1 | stream | ✅ | ✅ | ✅ | ✅ ok |
| gpt-3.5-turbo | text | ✅ | ✅ | ✅ | ✅ ok |
| gpt-3.5-turbo | tools | ✅ | ✅ | ✅ | ✅ ok |
| gpt-3.5-turbo | stream | ✅ | ✅ | ✅ | ✅ ok |
| gpt-4o-mini | text | ✅ | ✅ | ✅ | ✅ ok |
| gpt-4o-mini | tools | ✅ | ✅ | ✅ | ✅ ok |
| gpt-4o-mini | stream | ✅ | ✅ | ✅ | ✅ ok |
| gpt-4 | text | ✅ | ✅ | ✅ | ✅ ok |
| gpt-4 | tools | ✅ | ✅ | ✅ | ✅ ok |
| gpt-4 | stream | ✅ | ✅ | ✅ | ✅ ok |
| gpt-4o | text | ✅ | ✅ | ✅ | ✅ ok |
| gpt-4o | tools | ✅ | ✅ | ✅ | ✅ ok |
| gpt-4o | stream | ✅ | ✅ | ✅ | ✅ ok |
| gpt-4-o-preview | text | ✅ | ✅ | ✅ | ✅ ok |
| gpt-4-o-preview | tools | ✅ | ✅ | ✅ | ✅ ok |
| gpt-4-o-preview | stream | ✅ | ✅ | ✅ | ✅ ok |

## Proxy Translation Tests

| Test | Model | Status | Detail | Duration |
|------|-------|--------|--------|----------|
| thinking-downgrade (older) | claude-haiku-4.5 | ❌ |  | 1.8s |
| effort→suffix (4.7) | claude-opus-4.7 | ✅ |  | 1.6s |
| effort→param (4.6) | claude-opus-4.6 | ✅ |  | 1.3s |
| 1m-header-upgrade | claude-opus-4.6 | ✅ |  | 1.2s |
| responses-via-messages | gpt-5.5 | ✅ |  | 1.6s |
| responses-via-chat | gpt-5.5 | ✅ |  | 1.4s |

## Proxy Bugs (pass direct, fail proxy)

- **claude-sonnet-4.6** / tools: no tool_use (200)
- **gemini-3.1-pro-preview** / tools: no tool_use (200)

## Upstream Limitations (fail both)

- **gemini-3.1-pro-preview** / text: 200: {"choices":[{"finish_reason":"length","index":0,"message":{"
- **gpt-5.4** / text: 200: {"id":"LGLhvONJuEbNsPgnOPrYR7A2W+hACMWVSBsPd1lXWX2o0JUd9cIOK
- **gpt-5-mini** / text: 200: {"id":"SSmQbwhYoeAhbyb27i0Uc27TK/lHFeC+DNePvhl7qICO1AwTTOcBm
- **gpt-5-mini** / tools: no tool_use (200)
- **gemini-3-flash-preview** / text: 200: {"choices":[{"finish_reason":"length","index":0,"message":{"
- **gemini-2.5-pro** / text: 200: {"choices":[{"finish_reason":"length","index":0,"message":{"
- **gemini-2.5-pro** / tools: no tool_use (200)
- **gpt-41-copilot** / text: 400: {"error":{"message":"Model is not supported for this request
- **gpt-41-copilot** / tools: no tool_use (400)
- **gpt-41-copilot** / stream: no SSE events (400)

---
Generated by proxy-model-validation.ts