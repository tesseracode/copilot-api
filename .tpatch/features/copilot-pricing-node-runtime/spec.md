# Specification

1. Pricing updater runs under built Node without a Bun global.
2. Recovery updates fetched/validated/error/stale fields correctly.
3. Published pricing is intersected with the current catalog; missing price never blocks a model.
4. Diagnostics separate unmatched docs, inaccessible mapped rows, and accessible unpriced models.
5. HTTP ETag matches the published representation and If-None-Match returns bodyless 304.
6. Source ETag remains distinct from public representation ETag.
7. Node runtime, updater, filtering, and conditional GET tests pass.
