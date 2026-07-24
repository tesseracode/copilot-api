# Exploration

- `src/server.ts`: global `cors()` and environment-only health version.
- `package.json`: authoritative current version.
- `src/routes/token/route.ts` and `src/routes/usage/route.ts`: private/internal surfaces.
- `src/routes/responses/route.ts`: only POST create/stream currently exists.
- Add server tests for version, absent CORS, and unsupported Responses lifecycle methods.
