# Feature Request: Fix process hanging after Ctrl+C: srvx graceful shutdown closes the server but the copilot token refresh setInterval keeps the event loop alive under Bun. Clear the interval on SIGINT/SIGTERM, or call process.exit() after server close.

**Slug**: `graceful-shutdown-fix`
**Created**: 2026-05-15T23:25:00Z

## Description

Fix process hanging after Ctrl+C: srvx graceful shutdown closes the server but the copilot token refresh setInterval keeps the event loop alive under Bun. Clear the interval on SIGINT/SIGTERM, or call process.exit() after server close.
