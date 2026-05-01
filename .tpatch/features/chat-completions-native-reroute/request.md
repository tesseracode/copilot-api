# Feature Request: Add /v1/messages native routing to the /chat/completions handler: when resolveEndpoint returns /v1/messages for a Claude model sent to /chat/completions, reroute to native passthrough instead of forwarding through the lossy /chat/completions translation. Not a bug fix (upstream /chat/completions works for Claude) but an optimization for preserving thinking blocks and prompt caching.

**Slug**: `chat-completions-native-reroute`
**Created**: 2026-05-01T07:43:54Z

## Description

Add /v1/messages native routing to the /chat/completions handler: when resolveEndpoint returns /v1/messages for a Claude model sent to /chat/completions, reroute to native passthrough instead of forwarding through the lossy /chat/completions translation. Not a bug fix (upstream /chat/completions works for Claude) but an optimization for preserving thinking blocks and prompt caching.
