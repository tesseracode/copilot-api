# Feature Request: Preserve GPT-5.x reasoning blocks through proxy translation: map Responses API 'reasoning' output items to 'reasoning_text' in /chat/completions responses and to 'thinking' blocks in /v1/messages Anthropic responses. Currently reasoning blocks are silently dropped, breaking multi-turn context for reasoning models.

**Slug**: `reasoning-block-preservation`
**Created**: 2026-04-28T23:22:23Z

## Description

Preserve GPT-5.x reasoning blocks through proxy translation: map Responses API 'reasoning' output items to 'reasoning_text' in /chat/completions responses and to 'thinking' blocks in /v1/messages Anthropic responses. Currently reasoning blocks are silently dropped, breaking multi-turn context for reasoning models.
