# Feature Request: Upgrade srvx 0.8.9 → 0.11.15 to fix Node.js premature signal abort. The old srvx Node adapter fired AbortController on every HTTP req.close event, causing fetch() with request signal to abort immediately. The new version only aborts when response wasn't finished or request errored. Root cause of all 'This operation was aborted' errors on the built binary (node dist/main.js).

**Slug**: `srvx-signal-fix`
**Created**: 2026-05-01T09:15:16Z

## Description

Upgrade srvx 0.8.9 → 0.11.15 to fix Node.js premature signal abort. The old srvx Node adapter fired AbortController on every HTTP req.close event, causing fetch() with request signal to abort immediately. The new version only aborts when response wasn't finished or request errored. Root cause of all 'This operation was aborted' errors on the built binary (node dist/main.js).
