# Specification

## Refresh behavior

1. The cached model catalog is refreshed on a recurring interval rather than only at startup.
2. A refresh replaces `state.models` and updates both `state.modelsObservedAt` and `state.modelsFingerprint`, so the provenance markers always describe the snapshot currently in use.
3. Only one refresh is ever in flight; overlapping triggers share the pending refresh.
4. A failed refresh is non-fatal: it logs a warning and leaves the previous catalog snapshot serving traffic.
5. The refresh timer never holds the event loop open and is cleared on `SIGINT` and `SIGTERM`, preserving current one-interrupt shutdown behavior.

## Operator control

6. The interval is configurable, and the value `0` disables refresh entirely so a deployment can pin a catalog for reproducible compatibility runs.
7. The default interval is documented and chosen against the upstream `cache-control: private, max-age=21600` hint rather than an arbitrary number.
8. `README.md` documents the option, the default, the pinning behavior, and the interaction with the catalog provenance markers.

## Observability

9. A refresh that changes the catalog logs the change at info level, naming added and removed model IDs, so adopting a new model is never silent.
10. A refresh that produces an identical catalog does not log a change and does not alter the observation timestamp's meaning as "when this snapshot was observed".
11. Because `X-Copilot-API-Catalog` and `X-Copilot-API-Catalog-Observed-At` are the audit trail for mid-process routing changes, a refresh that changes routing content is observable to a canary without reading server logs.

## Safety

12. Refresh never runs before the Copilot token is available and never introduces an unauthenticated upstream call.
13. Catalog refresh failures never surface as client-visible errors on `/models` while a previous snapshot exists.
14. Tests drive refresh, failure recovery, single-flight behavior, and disabled-interval behavior through an injectable updater, with no live network access.

## Compatibility

15. Startup behavior is unchanged: the first catalog load still happens before the server accepts traffic.
16. Model filtering, pricing metadata, endpoint routing, and all inference routes keep their current behavior.
17. Existing pricing scheduler behavior is untouched; the two schedulers remain independent.
