# Feature Request: Improve error differentiation: AbortError from client disconnect vs HTTPError from upstream rejection both surface as the generic 'This operation was aborted' message. Add context to distinguish token expiry (401/403), upstream rejection (!response.ok), and client disconnect (signal.aborted) in forwardError.

**Slug**: `error-differentiation`
**Created**: 2026-05-01T07:43:54Z

## Description

Improve error differentiation: AbortError from client disconnect vs HTTPError from upstream rejection both surface as the generic 'This operation was aborted' message. Add context to distinguish token expiry (401/403), upstream rejection (!response.ok), and client disconnect (signal.aborted) in forwardError.
