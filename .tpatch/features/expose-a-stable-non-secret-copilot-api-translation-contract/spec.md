# Specification

## Markers

1. `/models` and `/v1/models` both return `X-Copilot-API-Translation-Contract`, a stable token identifying **proxy-owned translation semantics only**.
2. `/models` and `/v1/models` both return `X-Copilot-API-Build`, carrying the package version plus the injected build revision.
3. `/models` and `/v1/models` both return `X-Copilot-API-Catalog`, a fingerprint of the upstream catalog this process actually routes on, computed locally because upstream exposes no `etag`, version, generation, or revision.
4. The catalog fingerprint covers only routing-relevant content — model `id`, `supported_endpoints`, and `capabilities` — normalized by sorted model ID so that response ordering, and fields that do not affect routing, cannot change it.
5. The catalog fingerprint is identical for every request served from one cached catalog snapshot, and differs when routing-relevant catalog content differs.
6. `/models` and `/v1/models` both return `X-Copilot-API-Catalog-Observed-At`, an ISO-8601 UTC timestamp recording when the current catalog snapshot was observed — not the current time, so it is fixed for the lifetime of a snapshot.
7. All four markers are byte-identical across both mounted paths for the same process; parity is asserted by test.

## Honest scoping

7. No marker, alone or combined, claims end-to-end behavioral reproducibility. The published contract states only that identical markers mean the proxy's own translation code and its view of upstream were identical.
8. The observation timestamp exists to date the fingerprint: an unchanged fingerprint means "upstream did not change" only when read together with a recent observation time, and otherwise means "this process has not looked again".
9. `README.md` documents the explicit non-guarantee with its causes: upstream model behavior can change behind an unchanged model ID, upstream performs per-account experiment assignment, and the catalog snapshot is loaded once at startup so it may be arbitrarily stale.
10. `README.md` documents the change policy per marker: the contract token changes only when externally observable proxy translation semantics change, the build identity changes per build, and the catalog fingerprint and observation timestamp change only when a new catalog snapshot is loaded.
11. The contract token is a single documented constant in one module and is not derived from the package version.

## Safety

12. The build revision is read once from `COPILOT_API_BUILD_REVISION`; missing, blank, or non-conforming values resolve to the literal `unknown`.
13. Revision input is sanitized to a bounded charset and length, so injected values cannot smuggle header separators, paths, identity, or arbitrary text.
14. No marker exposes GitHub or Copilot tokens, account identity, filesystem paths, dirty-tree state, or per-request runtime counters. The observation timestamp is snapshot metadata fixed per catalog load, not a live clock or uptime counter, and discloses nothing beyond the `uptime_seconds` already published by `/health`.
15. The upstream `x-copilot-api-exp-assignment-context` header is never propagated or incorporated into any marker, being account-scoped experiment assignment.
16. The catalog fingerprint is a one-way digest that exposes no model list, entitlement, or account detail to a client that could not already read the model list.

## Compatibility

17. The model-list response body is unchanged: same keys, same order, same pricing and catalog metadata as before.
18. The Docker build accepts the revision through a build argument and bakes it into the runtime environment, defaulting to `unknown` when not supplied.
19. `/health`, pricing routes, model filtering, and all inference routes keep their current behavior.
20. Marker computation adds no upstream request and no per-request catalog work.
