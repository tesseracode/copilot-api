# Specification

## Anthropic version mapping

1. An Anthropic dash version maps to the Copilot dot form without an explicit map entry: `claude-opus-4-8` becomes `claude-opus-4.8`.
2. The reverse direction is symmetric: `claude-opus-4.8` becomes `claude-opus-4-8`.
3. A round trip through both directions returns the original identifier.
4. Single-segment versions are unchanged in both directions: `claude-sonnet-5` and `claude-opus-5` map to themselves.
5. A date suffix is never read as a minor version; `claude-sonnet-4-20250514` still reduces to `claude-sonnet-4`.
6. Derivation composes with the existing suffix handling, so `claude-opus-4-8-xhigh` yields `claude-opus-4.8` and `-1m` / `[1m]` resolution is unchanged.
7. Every identifier the previous enumeration handled maps to the same result as before.
8. Non-Claude identifiers pass through untouched.

## Pricing name mapping

9. A pricing display name reduces to a catalog model ID by stripping markdown footnote markers, lowercasing, and replacing whitespace runs with dashes.
10. A name matches identically whether or not it carries a footnote marker, so a promotion cannot break the mapping.
11. Models with no explicit alias receive pricing, including `gpt-6-astra`, `grok-4.5`, `grok-4.6`, `claude-opus-5`, `claude-sonnet-5`, `gemini-3.6-flash`, `gemini-3.7-flash`, `gemini-3.8-flash` and `mai-code-1.1-flash`.
12. Names that do not reduce to a valid model identifier remain unattached and are still reported in `unmatched_models`, so a prose row such as `Claude Opus 4.8 (fast mode) (preview)` is not treated as a model.
13. A derived entry attaches to its own identifier only and never alters pricing for another model.
14. Explicit aliases still take precedence, preserving `MAI-Code-1-Flash` to `mai-code-1-flash-picker`.

## Scope

15. Both maps are retained solely for identifiers that break the convention; entries reproducible by the rule are removed.
16. No request or response shape changes, and no catalog gating is introduced for either transformation.
17. The reversal of the earlier "report unmatched rather than guess" rule is stated in the tests, with the measurement that justifies it.
