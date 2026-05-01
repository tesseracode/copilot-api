# Upstream Endpoint Compatibility Matrix

**Date**: 2026-05-01
**Method**: Direct probe (bypassing proxy) — 8 models × 3 endpoints = 24 API calls

## Results

| Model | `/chat/completions` | `/v1/messages` | `/responses` |
|-------|:---:|:---:|:---:|
| claude-opus-4.6 | ✅ | ✅ | ❌ "does not support Responses API" |
| claude-sonnet-4 | ✅ | ✅ | ❌ |
| claude-haiku-4.5 | ✅ | ✅ | ❌ |
| gpt-5.5 | ❌ "not accessible via /chat/completions" | ❌ "selecting model endpoint" | ✅ |
| gpt-5.4 | ❌ "max_tokens not supported" | ❌ "selecting model endpoint" | ✅ |
| gpt-5-mini | ✅ | ❌ "selecting model endpoint" | ⚠️ (returns but content may be null) |
| gpt-4o | ✅ | ❌ "selecting model endpoint" | ❌ "not supported via Responses API" |
| gemini-2.5-pro | ⚠️ (truncated, finish_reason=length) | ❌ "selecting model endpoint" | ❌ |

## Key findings

### 1. `/v1/messages` is Claude-only
The upstream hard-gates `/v1/messages` to Claude models. All non-Claude models fail with "building HTTP client: selecting model endpoint". This is NOT cosmetic — it's enforced server-side.

### 2. `supported_endpoints` is accurate
The field in the `/models` response accurately reflects what the upstream accepts. There's no hidden compatibility — if a model doesn't list an endpoint, it won't work.

### 3. GPT-5.x is truly responses-only
`gpt-5.5` is explicitly blocked on `/chat/completions`: "model 'gpt-5.5' is not accessible via /chat/completions". Our `/responses` routing is the only path that works for these models.

### 4. GPT-5.4 rejects `max_tokens`
The `/responses` API uses `max_output_tokens`, not `max_tokens`. When GPT-5.4 receives a `/chat/completions` request with `max_tokens`, it rejects it. Our `translateRequestToResponses` correctly maps `max_tokens` → `max_output_tokens`.

### 5. Claude models work on both endpoints
Claude models accept both `/chat/completions` (OpenAI format) and `/v1/messages` (Anthropic format). Using `/v1/messages` is preferred for native feature preservation (thinking blocks, prompt caching).

## Implications for proxy routing

| Client sends to | Model type | Our routing | Correct? | Optimal? |
|----------------|-----------|-------------|:---:|:---:|
| `/v1/messages` | Claude | Native passthrough | ✅ | ✅ |
| `/v1/messages` | GPT-5.x | Translate → `/responses` | ✅ | ✅ |
| `/v1/messages` | GPT-4.x/Gemini | Translate → `/chat/completions` | ✅ | ✅ |
| `/chat/completions` | Claude | Forward to upstream `/chat/completions` | ✅ | ⚠️ Lossy — should reroute to `/v1/messages` |
| `/chat/completions` | GPT-5.x | Route to `/responses` | ✅ | ✅ |
| `/chat/completions` | GPT-4.x/Gemini | Forward to upstream `/chat/completions` | ✅ | ✅ |

The only suboptimal path: Claude via `/chat/completions` works but loses native features. Registered as `chat-completions-native-reroute` feature.
