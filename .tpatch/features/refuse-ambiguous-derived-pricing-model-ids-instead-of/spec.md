# Specification

1. When two distinct display names derive the same model ID, every colliding row is left unattached with `model: null`.
2. No published catalog ever contains two rows sharing a model ID.
3. `pricingForModel` returns nothing for an ambiguous ID rather than an arbitrary one of the candidate prices.
4. All colliding display names are preserved in `unmatched_models`, so the ambiguity is visible to an operator.
5. `unmatched_models` reports each display name at most once.
6. An explicit `MODEL_ALIASES` entry that collides with a derived name is treated as ambiguous on the same terms.
7. Models in the same source that do not collide keep their pricing.
8. A footnoted name with no plain twin still resolves normally, preserving the coverage gained by derivation.
9. Repeated identical display names continue to merge into one entry with `default` and `long-context` tiers, unchanged.
10. Prose rows that do not reduce to a valid identifier remain unattached and reported, as before.
11. Live pricing coverage is unchanged: the current table still yields 30 entries with no duplicates and only the known prose row unmatched.
