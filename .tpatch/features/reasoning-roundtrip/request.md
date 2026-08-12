# Feature Request: Map inbound thinking blocks to reasoning input items for /responses API multi-turn: when an Anthropic-format assistant message contains thinking blocks that originated from GPT-5.x reasoning, translate them back to type=reasoning input items instead of plain text. Blocked until Copilot populates reasoning summaries.

**Slug**: `reasoning-roundtrip`
**Created**: 2026-04-28T23:59:19Z

## Description

Map inbound thinking blocks to reasoning input items for /responses API multi-turn: when an Anthropic-format assistant message contains thinking blocks that originated from GPT-5.x reasoning, translate them back to type=reasoning input items instead of plain text. Blocked until Copilot populates reasoning summaries.

Measured 2026-08-11 against the local proxy and current private Copilot gateway using catalog-selected `gpt-5.4-mini`: native buffered and streaming Responses output includes a non-empty opaque reasoning `id`, `summary:[]`, and populated `encrypted_content`. Replaying that provider-issued reasoning item succeeds with HTTP 200; replacing its id with `""` is rejected directly with HTTP 400 `invalid_request_body`. The current `/v1/messages` translation path cannot emit a reasoning item: thinking is flattened into assistant text before `translateRequestToResponses`, and buffered/streaming two-turn tool loops returned HTTP 200 without malformed reasoning input. The previously reported HTTP 502 therefore does not originate from the current repository path. There is still no useful summary text to map into Anthropic thinking, and lossless future replay would require a proxy-owned representation preserving the provider-issued reasoning id, encrypted content, and provenance. Until that contract exists, empty summaries and untrusted or foreign thinking blocks must not produce reasoning input items.
