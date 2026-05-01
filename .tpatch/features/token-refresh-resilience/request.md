# Feature Request: Token refresh resilience: if the setInterval copilot token refresh throws, the interval dies silently and the token stays stale forever. Should retry with backoff, or at minimum log a prominent warning that all future requests will fail until restart.

**Slug**: `token-refresh-resilience`
**Created**: 2026-05-01T07:43:54Z

## Description

Token refresh resilience: if the setInterval copilot token refresh throws, the interval dies silently and the token stays stale forever. Should retry with backoff, or at minimum log a prominent warning that all future requests will fail until restart.
