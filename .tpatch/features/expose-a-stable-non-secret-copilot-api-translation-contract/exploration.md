# Exploration

- `src/routes/models/route.ts`: single `GET /` handler that builds the OpenAI model list; the only place both mounted model paths converge, so one header change covers both.
- `src/server.ts:34,42`: `modelRoutes` is mounted at `/models` and `/v1/models`, and `/health` already returns `packageJson.version` — provenance must not duplicate its mutable counters.
- New `src/lib/build-info.ts`: single source of truth for the semantic contract token, package version, sanitized revision, and the catalog fingerprint/observed-at helpers; read once at module load, no per-request work and no runtime `.git` access.
- `src/lib/utils.ts` + `src/start.ts:66`: `cacheModels()` is the only catalog load and runs once at startup with no refresh timer, so the fingerprint and observation timestamp can be recorded at load time and stay constant for the process lifetime.
- `src/services/copilot/pricing-scheduler.ts`: the proven refresh pattern (single-flight, non-fatal failure, `unref()`, SIGINT/SIGTERM cleanup, injectable updater) that the dependent catalog-refresh follow-up should mirror — referenced here only to mark it out of scope.
- `src/lib/state.ts`: holds `state.models`, the exact catalog snapshot the proxy routes on and therefore the correct fingerprint input.
- `src/services/copilot/get-models.ts`: upstream fetch discards response headers; the probe confirmed there is nothing there to propagate (no `etag`, no catalog version).
- `src/routes/responses/route.ts`: existing precedent for setting selected non-secret response headers via `new Headers()`.
- `Dockerfile`: builder/runner split with no `.git` in the runner image; needs an `ARG`/`ENV` pair so deployments can inject the revision at build time.
- `tests/operational-hardening.test.ts`: already exercises `/health` version and iterates `/v1/models` for header assertions — natural home for parity, sanitization, and `unknown`-fallback cases.
- `package.json`: version already imported as a typed JSON module in `src/server.ts`, so the same import works from `src/lib/`.
- `README.md` §API Endpoints: existing section for endpoint documentation and the change-policy note.
- Gateway evidence: `tesseragateway@cf8b650` `docs/contracts/inference-compatibility.md` (matrix v4) records that catalog generation is not build identity, that the deployed proxy revision is unprovable today, and explicitly warns "do not use catalog generation as a build ID" — three separate axes the gateway already distinguishes.
- Upstream probe evidence (2026-08-13): `/models` returns no `etag`/`last-modified`, body top-level keys are only `data` and `object`, per-model `version` is a model snapshot label, `cache-control: private, max-age=21600`, catalog byte-stable across back-to-back calls, count drifted 40 → 41 since 2026-08-11, and `x-copilot-api-exp-assignment-context` (86 chars) proves per-account experiment assignment.
- Out of scope: request-path changes, body-shape changes, CORS, any header on inference routes, propagating upstream experiment-assignment context, and any claim of end-to-end behavioral reproducibility.
