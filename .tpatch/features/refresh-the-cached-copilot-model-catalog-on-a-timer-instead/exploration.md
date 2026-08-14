# Exploration

- `src/services/copilot/pricing-scheduler.ts`: the pattern to mirror — single-flight `refreshPromise ??=`, non-fatal `catch` that keeps the last good cache, `scheduleNextRefresh` with `timer.unref()`, `SIGINT`/`SIGTERM` handlers installed once, and an injectable updater parameter for tests.
- `src/lib/utils.ts`: `cacheModels()` is the single catalog load and already sets `state.models`, `state.modelsObservedAt`, and `state.modelsFingerprint`, so it is the correct refresh unit and needs no new fingerprinting logic.
- `src/start.ts:66`: the sole startup call; the scheduler should start after this so the first snapshot is still loaded before traffic is served, next to the existing `startPricingScheduler` call.
- `src/lib/state.ts`: holds the snapshot plus its observation timestamp and fingerprint; comparing the old and new fingerprint is the cheapest change detector for the info-level log.
- `src/lib/build-info.ts`: `catalogFingerprint()` is already pure and exported, so change detection needs no new hashing code.
- `src/routes/models/route.ts`: emits the provenance markers and has a fallback `cacheModels()` call for an empty catalog; the scheduler must not double-load with it.
- `src/start.ts` CLI options + `README.md` §Start Command Options: where a `--catalog-refresh-interval`-style option and its `0` disables semantics are wired and documented.
- `tests/pricing-scheduler.test.ts` and `tests/pricing-updater-recovery.test.ts`: the testing precedent for driving a scheduler through an injected updater without network access.
- `tests/operational-hardening.test.ts`: already asserts the provenance markers, so refresh-driven marker changes can be asserted alongside them.
- Measured basis: upstream `/models` serves `cache-control: private, max-age=21600`, and the catalog moved 40 → 41 models between 2026-08-11 and 2026-08-13.
- Out of scope: changing routing rules, prefetching or warming models, per-request catalog reads, and any change to the pricing scheduler.
