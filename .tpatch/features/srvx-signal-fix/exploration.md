# Exploration: srvx Signal Fix

## Files Changed

- `package.json` — srvx version constraint `^0.8.9` → `^0.11.15`
- `bun.lock` — lockfile updated

## Key Code Difference

The fix is entirely in `node_modules/srvx/dist/adapters/node.mjs` — the Node adapter's `get signal()` getter. No application code changes needed.

Old (0.8.x): `req.once("close", () => abort())` — fires on ANY close including body-consumed
New (0.11.x): only aborts if `!res.writableEnded` or `req.errored` — matches actual disconnect semantics
