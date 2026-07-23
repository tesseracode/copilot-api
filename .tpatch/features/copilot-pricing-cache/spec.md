# Specification

1. Parse GitHub's canonical pricing YAML into model/tier records.
2. Support default and long-context thresholds plus cache prices.
3. Revalidate by ETag and retain last-good data on 304/error.
4. Write cache atomically with source hash, timestamps, and stale status.
5. Expose safe `GET /pricing` and `/v1/pricing` aliases.
6. Preserve `model_picker_category` and add `x_copilot_pricing` summaries to models.
7. Never expose credentials, account routes, or organization metadata.
8. Pricing parser/cache tests pass.

Out of scope: account quota accounting and non-Copilot provider prices.
