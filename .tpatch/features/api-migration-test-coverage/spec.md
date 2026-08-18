# Specification

Backfilled from the recorded patch (`artifacts/post-apply.patch`) so the feature's intent is
documented; the tests themselves were already applied and are unchanged by this file.

1. `anthropicToCopilotModelId` strips a dash-format `-1m` suffix, not only the bracket `[1m]` form.
2. A `-1m` model resolves to the base model when the catalog advertises no `-1m` variant.
3. A `-1m` model resolves to the `-1m` variant when the catalog does advertise one.
4. The dash and bracket 1M forms resolve identically.
5. Legacy effort suffixes are extracted from model names: `-xhigh`, `-high`, `-max` and `-low`.
6. A model name carrying no effort suffix yields an undefined effort.
7. `-1m` is never mistaken for an effort suffix.
8. `buildNativeBody` extracts effort from a legacy model-name suffix for backward compatibility.
9. An explicit `output_config.effort` takes priority over a model-name suffix.
10. `translateRequestToResponses` populates `reasoning.effort` when an effort is resolved.
11. `translateRequestToResponses` omits `reasoning` entirely when no effort is provided or it is
    undefined.
12. Coverage lives beside the code it exercises: `src/lib/model-mapping.test.ts`,
    `src/services/copilot/forward-native-messages.test.ts` and
    `tests/responses-effort-forwarding.test.ts`.
