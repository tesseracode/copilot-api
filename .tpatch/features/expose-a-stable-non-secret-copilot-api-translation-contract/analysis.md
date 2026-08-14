# Analysis

Tesseragateway records client compatibility canaries against this proxy but cannot prove which copilot-api translation semantics served them. The pinned gateway contract (`tesseragateway@cf8b650`, `docs/contracts/inference-compatibility.md`, matrix v4) states explicitly that catalog generation is not a build identity and that the deployed copilot-api revision is not currently provable.

Existing metadata is real but insufficient. `/health` returns `packageJson.version` (`src/server.ts:29`), and the model list returns catalog data plus `x_copilot_pricing.source_version`/`stale` (`src/routes/models/route.ts`). Both describe upstream models or the package release, not the proxy's own translation behavior. Two builds from one source version are indistinguishable, and version bumps do not map to externally observable translation changes: the last several behavior-critical fixes (`responses-instruction-role-preservation`, `response-refusal-preservation`, `stream-failure-visibility`) shipped without any version signal a canary could record.

The gap is therefore two distinct identities that are currently conflated: a **semantic translation-contract token** that changes only when observable translation semantics change, and a **build identity** that changes per build. A canary needs both — the first to bucket results, the second to attribute a regression to an exact artifact.

Response headers are the compatible carrier. `/models` and `/v1/models` mount one handler (`src/server.ts:34,42`) whose body is a strict OpenAI model list; adding body fields risks strict client validation, while headers leave the body byte-identical. This also matches the existing convention of forwarding `x-copilot-service-request-id`-style headers in `src/routes/responses/route.ts`.

Provenance must stay non-secret and immutable. GitHub/Copilot tokens, account identity, filesystem paths, dirty-tree state, and mutable runtime counters (uptime, model counts) are all out of scope — the counters already live on `/health` and are observations, not provenance. The revision must be injected at build time via environment, never discovered from `.git` at runtime: the `dist` runner image contains no `.git`, and shelling out per request would be slow and could leak local working-tree state.

Compatibility risk is low. No request behavior, body shape, filtering, or pricing metadata changes, so existing clients and the `filter-models`/pricing features are unaffected.

## Measured upstream provenance (2026-08-13, `https://api.githubcopilot.com/models`)

A direct probe establishes that upstream exposes nothing this proxy could simply propagate:

- No `etag` and no `last-modified`; response headers carry only routing/telemetry values (`x-github-request-id`, `x-copilot-service-request-id`, `x-github-backend`).
- No catalog-level version, generation, or revision field — body top-level keys are exactly `data` and `object`.
- Per-model `version` is a model snapshot label (`gpt-4o-2024-11-20`, `claude-opus-4.8`), so it identifies a model, not a catalog state.
- `cache-control: private, max-age=21600` — upstream itself treats the catalog as changeable.
- The catalog is byte-identical across back-to-back calls, so a content fingerprint would be a stable signal rather than noise.
- Model count moved from 40 (2026-08-11 probe) to 41 (2026-08-13), proving the catalog drifts on its own timeline.
- `x-copilot-api-exp-assignment-context` (86 characters) is returned, so upstream performs server-side experiment assignment; behavior can differ without any catalog or proxy change. It is account-scoped and must never be propagated.
- `cacheModels()` runs once at startup (`src/start.ts:66`) with no refresh timer, so a long-running process serves a frozen catalog snapshot for its entire lifetime and can be arbitrarily stale relative to upstream.

## Scope correction: attribution, not reproducibility

The naive reading of this feature — "same contract plus same build implies the same result" — is false and must not be published. Observable behavior is `proxy translation ∘ upstream behavior`, and the measurements above show upstream moving underneath a fixed build in at least three independent ways: catalog drift, per-account experiment assignment, and silent model-behavior changes behind an unchanged model ID.

The header still has merit, but its value is **attribution**, not end-to-end reproducibility. Today a canary regression has an unbounded suspect list; the markers let an operator eliminate the proxy as a variable and say "the proxy code and its view of upstream were identical, therefore the change came from upstream." That is a weaker claim than reproducibility and the only one the proxy can honestly make.

This forces a third axis. Because upstream publishes no catalog identity, no consumer can compute one — the proxy is the only component positioned to observe and fingerprint the catalog it actually routed on. Without that axis, the contract and build markers are actively misleading: they would appear to hold behavior constant while the dominant variable stayed invisible. With it, the triple separates "proxy code changed", "proxy's view of upstream changed", and "neither changed, so upstream behavior itself moved".

The fingerprint alone is not sufficient, because it carries an ambiguity it cannot resolve. Two canary runs showing the same fingerprint could mean either "upstream did not change" or "this process never looked again" — and since `cacheModels()` has no refresh timer, the second is *always* true after startup, making the fingerprint's stability vacuous. Pairing it with the observation timestamp converts an unfalsifiable claim into a dated observation: catalog X, as seen at time T. The timestamp is snapshot metadata fixed per catalog load, not a live clock, so it does not reintroduce the mutable-counter problem that excludes uptime.

Catalog refresh itself is deliberately out of scope. Adding a refresh timer would change routing behavior mid-process and carries its own failure modes, whereas this feature is strictly observational and must stay low risk. The two are codependent rather than conflicting: a refresh timer without these markers would produce exactly the silent, unattributable drift the gateway complained about, so provenance must land first and refresh is tracked as a dependent follow-up.
