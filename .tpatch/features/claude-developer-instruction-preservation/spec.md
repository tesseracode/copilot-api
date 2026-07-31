# Resolution

Rejected after measurement. Preserve current Claude Chat passthrough behavior.

Acceptance evidence:

1. Sonnet 4.6, Opus 4.8, and Haiku 4.5 honor developer-only exact marker instructions.
2. System-only and aligned instructions are honored.
3. Conflicting system/developer instructions follow message order.
4. A later developer message after assistant/user turns is honored.
5. No production caller uses the lossy `openaiToAnthropicPayload` converter.
6. No source patch is recorded for this rejected feature.

Revisit only if Claude Chat behavior regresses, a model family rejects developer roles, or native Messages rerouting is restored.
