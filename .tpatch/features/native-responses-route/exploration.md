# Exploration

- `src/server.ts`: mount both route aliases.
- `src/lib/endpoint-routing.ts`: catalog endpoint eligibility pattern.
- `src/lib/copilot-fetch.ts`: authenticated upstream fetch with one 401 recovery.
- `src/services/copilot/create-responses.ts`: upstream URL and stream library, but translator is not reused.
- New `src/routes/responses/route.ts` and handler own native passthrough.
- Tests cover alias parity, field preservation, eligibility, stream bytes/events, abort, and errors.
