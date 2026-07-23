# Proxy Model Validation Report — 2026-07-10

## Summary
- Models discovered: 40
- Models tested: 37
- Tests: 111 smoke + 6 translation + 0 capability = 117 total
- Smoke: 97 ok, 1 proxy bugs, 13 upstream limitations
- Translation: 5/6 pass
- Capability: 0/0 pass

## Model Profiles

| Model | Endpoint | Tools | Thinking | Effort | Temp | Max Output |
|-------|----------|-------|----------|--------|------|------------|
| claude-opus-4.6 | /v1/messages | ✅ | adaptive | param | ✅ | 64000 |
| claude-opus-4.7 | /v1/messages | ✅ | adaptive | suffix | ✅ | 64000 |
| claude-opus-4.8 | /v1/messages | ✅ | enabled-only | none | ✅ | 64000 |
| claude-sonnet-4.6 | /v1/messages | ✅ | adaptive | param | ✅ | 64000 |
| claude-sonnet-5 | /v1/messages | ✅ | enabled-only | none | ✅ | 64000 |
| gemini-3.1-pro-preview | /chat/completions | ✅ | none | none | ✅ | 64000 |
| gemini-3.5-flash | /chat/completions | ✅ | none | none | ✅ | 64000 |
| gpt-5.3-codex | /responses | ✅ | none | none | ❌ | 128000 |
| gpt-5.4-mini | /responses | ✅ | none | none | ❌ | 128000 |
| gpt-5.4 | /responses | ✅ | none | none | ❌ | 128000 |
| gpt-5.5 | /responses | ✅ | none | none | ❌ | 128000 |
| gpt-5.6-luna | /responses | ✅ | none | none | ❌ | 128000 |
| gpt-5.6-sol | /responses | ✅ | none | none | ❌ | 128000 |
| gpt-5.6-terra | /responses | ✅ | none | none | ❌ | 128000 |
| mai-code-1-flash-picker | /responses | ✅ | none | none | ❌ | 128000 |
| trajectory-compaction | /chat/completions | ✅ | none | none | ✅ | 16384 |
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
| gpt-4o | /chat/completions | ✅ | none | none | ✅ | 4096 |

## Smoke Tests

| Model | Test | Direct | Proxy /msg | Proxy /chat | Blame |
|-------|------|--------|-----------|-------------|-------|
| claude-opus-4.6 | text | ✅ | ✅ | ✅ | ✅ ok |
| claude-opus-4.6 | tools | ✅ | ✅ | ✅ | ✅ ok |
| claude-opus-4.6 | stream | ✅ | ✅ | ✅ | ✅ ok |
| claude-opus-4.7 | text | ✅ | ✅ | ✅ | ✅ ok |
| claude-opus-4.7 | tools | ✅ | ✅ | ✅ | ✅ ok |
| claude-opus-4.7 | stream | ✅ | ✅ | ✅ | ✅ ok |
| claude-opus-4.8 | text | ✅ | ✅ | ✅ | ✅ ok |
| claude-opus-4.8 | tools | ✅ | ✅ | ✅ | ✅ ok |
| claude-opus-4.8 | stream | ✅ | ✅ | ✅ | ✅ ok |
| claude-sonnet-4.6 | text | ✅ | ✅ | ✅ | ✅ ok |
| claude-sonnet-4.6 | tools | ✅ | ✅ | ✅ | ✅ ok |
| claude-sonnet-4.6 | stream | ✅ | ✅ | ✅ | ✅ ok |
| claude-sonnet-5 | text | ✅ | ✅ | ✅ | ✅ ok |
| claude-sonnet-5 | tools | ✅ | ✅ | ✅ | ✅ ok |
| claude-sonnet-5 | stream | ✅ | ✅ | ✅ | ✅ ok |
| gemini-3.1-pro-preview | text | ❌ | ❌ | ❌ | ⚠️ upstream |
| gemini-3.1-pro-preview | tools | ❌ | ❌ | ❌ | ⚠️ upstream |
| gemini-3.1-pro-preview | stream | ✅ | ✅ | ✅ | ✅ ok |
| gemini-3.5-flash | text | ❌ | ❌ | ❌ | ⚠️ upstream |
| gemini-3.5-flash | tools | ✅ | ✅ | ✅ | ✅ ok |
| gemini-3.5-flash | stream | ✅ | ✅ | ✅ | ✅ ok |
| gpt-5.3-codex | text | ✅ | ❌ | ✅ | 🐛 proxy-bug |
| gpt-5.3-codex | tools | ✅ | ✅ | ✅ | ✅ ok |
| gpt-5.3-codex | stream | ✅ | ✅ | ✅ | ✅ ok |
| gpt-5.4-mini | text | ✅ | ✅ | ✅ | ✅ ok |
| gpt-5.4-mini | tools | ✅ | ✅ | ✅ | ✅ ok |
| gpt-5.4-mini | stream | ✅ | ✅ | ✅ | ✅ ok |
| gpt-5.4 | text | ❌ | ❌ | ✅ | ⚠️ upstream |
| gpt-5.4 | tools | ✅ | ✅ | ✅ | ✅ ok |
| gpt-5.4 | stream | ✅ | ✅ | ✅ | ✅ ok |
| gpt-5.5 | text | ✅ | ✅ | ✅ | ✅ ok |
| gpt-5.5 | tools | ✅ | ✅ | ✅ | ✅ ok |
| gpt-5.5 | stream | ✅ | ✅ | ✅ | ✅ ok |
| gpt-5.6-luna | text | ✅ | ✅ | ✅ | ✅ ok |
| gpt-5.6-luna | tools | ✅ | ✅ | ✅ | ✅ ok |
| gpt-5.6-luna | stream | ✅ | ✅ | ✅ | ✅ ok |
| gpt-5.6-sol | text | ✅ | ✅ | ✅ | ✅ ok |
| gpt-5.6-sol | tools | ✅ | ✅ | ✅ | ✅ ok |
| gpt-5.6-sol | stream | ✅ | ✅ | ✅ | ✅ ok |
| gpt-5.6-terra | text | ✅ | ✅ | ✅ | ✅ ok |
| gpt-5.6-terra | tools | ✅ | ✅ | ✅ | ✅ ok |
| gpt-5.6-terra | stream | ✅ | ✅ | ✅ | ✅ ok |
| mai-code-1-flash-picker | text | ❌ | ❌ | ❌ | ⚠️ upstream |
| mai-code-1-flash-picker | tools | ✅ | ✅ | ✅ | ✅ ok |
| mai-code-1-flash-picker | stream | ✅ | ✅ | ✅ | ✅ ok |
| trajectory-compaction | text | ❌ | ❌ | ❌ | ⚠️ upstream |
| trajectory-compaction | tools | ✅ | ✅ | ✅ | ✅ ok |
| trajectory-compaction | stream | ✅ | ✅ | ✅ | ✅ ok |
| gpt-5-mini | text | ❌ | ❌ | ❌ | ⚠️ upstream |
| gpt-5-mini | tools | ✅ | ✅ | ✅ | ✅ ok |
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
| gemini-3-flash-preview | tools | ❌ | ✅ | ✅ | 🤔 proxy-fix |
| gemini-3-flash-preview | stream | ✅ | ✅ | ✅ | ✅ ok |
| gemini-2.5-pro | text | ❌ | ❌ | ❌ | ⚠️ upstream |
| gemini-2.5-pro | tools | ❌ | ❌ | ❌ | ⚠️ upstream |
| gemini-2.5-pro | stream | ✅ | ✅ | ✅ | ✅ ok |
| gpt-4.1-2025-04-14 | text | ✅ | ✅ | ✅ | ✅ ok |
| gpt-4.1-2025-04-14 | tools | ✅ | ✅ | ✅ | ✅ ok |
| gpt-4.1-2025-04-14 | stream | ✅ | ✅ | ✅ | ✅ ok |
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
| gpt-4o | text | ✅ | ✅ | ✅ | ✅ ok |
| gpt-4o | tools | ✅ | ✅ | ✅ | ✅ ok |
| gpt-4o | stream | ✅ | ✅ | ✅ | ✅ ok |

## Proxy Translation Tests

| Test | Model | Status | Detail | Duration |
|------|-------|--------|--------|----------|
| thinking-downgrade (older) | claude-haiku-4.5 | ❌ |  | 1.7s |
| effort→suffix (4.7) | claude-opus-4.7 | ✅ |  | 2.3s |
| effort→param (4.6) | claude-opus-4.6 | ✅ |  | 1.7s |
| 1m-header-upgrade | claude-opus-4.6 | ✅ |  | 2.3s |
| responses-via-messages | gpt-5.5 | ✅ |  | 1.5s |
| responses-via-chat | gpt-5.5 | ✅ |  | 1.2s |

## Proxy Bugs (pass direct, fail proxy)

- **gpt-5.3-codex** / text: 200: {"id":"cogK6DiC6cK9uiv+OnhfhJerrzkopI15ZSyknXntEAIGvRlSJ5OUQ

## Upstream Limitations (fail both)

- **gemini-3.1-pro-preview** / text: 200: {"choices":[{"finish_reason":"length","index":0,"message":{"
- **gemini-3.1-pro-preview** / tools: no tool_use (200)
- **gemini-3.5-flash** / text: 200: {"choices":[{"finish_reason":"length","index":0,"message":{"
- **gpt-5.4** / text: 200: {"id":"pHAwPVNh/DTJLCl4+hhMO2egY4cHWfxNYyNUd+KvqwUYgjMrqmLfB
- **mai-code-1-flash-picker** / text: 200: {"id":"KyYGCozft1fAF+UuLNx4SmTjm4aEVNBpAvg8cm72Jdm0w4L0qgzuv
- **trajectory-compaction** / text: 200: {"choices":[{"finish_reason":"length","index":0,"content_fil
- **gpt-5-mini** / text: 200: {"id":"kP5KGutG4BP1sNTGfXm3KgS8UoDZ7xcHw3eZVFpe4LlfDlwU3hZ3D
- **gemini-3-flash-preview** / text: 200: {"choices":[{"finish_reason":"length","index":0,"message":{"
- **gemini-2.5-pro** / text: 200: {"choices":[{"finish_reason":"length","index":0,"message":{"
- **gemini-2.5-pro** / tools: no tool_use (200)
- **gpt-41-copilot** / text: 400: {"error":{"message":"Model is not supported for this request
- **gpt-41-copilot** / tools: no tool_use (400)
- **gpt-41-copilot** / stream: no SSE events (400)

---
Generated by proxy-model-validation.ts