# Spec: srvx Signal Fix

## Acceptance Criteria

1. `node dist/main.js start` serves requests without aborting
2. GPT-5.5, Claude, and Gemini models all respond through the built binary
3. Go clients (`Go-http-client/1.1` with `accept-encoding: gzip`) work correctly
4. `bun run ./src/main.ts` continues to work (no regression)
5. Signal-based abort propagation still works for actual client disconnects

## Change

Single dependency update: `srvx ^0.8.9 → ^0.11.15` in `package.json`
