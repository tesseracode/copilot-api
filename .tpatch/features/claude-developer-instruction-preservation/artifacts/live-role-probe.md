# Claude developer instruction live probe

Unique marker: `IFSU52`. Requests used `/v1/chat/completions`, non-streaming, `max_tokens: 256`, supported effort, and exact-response instructions. Native `/v1/messages` top-level system blocks were controls, not role-equivalence tests.

| Model | Case | Chat result |
|---|---|---|
| claude-sonnet-4.6 | system only | `SYS_IFSU52` |
| claude-sonnet-4.6 | developer only | `DEV_IFSU52` |
| claude-sonnet-4.6 | aligned | `BOTH_IFSU52` |
| claude-sonnet-4.6 | system then developer | `DEV_IFSU52` |
| claude-sonnet-4.6 | developer then system | `SYS_IFSU52` |
| claude-sonnet-4.6 | two developer messages across turns | `DEV_NEW_IFSU52` |
| claude-opus-4.8 | system only | `SYS_IFSU52` |
| claude-opus-4.8 | developer only | `DEV_IFSU52` |
| claude-opus-4.8 | aligned | `BOTH_IFSU52` |
| claude-opus-4.8 | system then developer | `DEV_IFSU52` |
| claude-opus-4.8 | developer then system | `SYS_IFSU52` |
| claude-opus-4.8 | two developer messages across turns | `DEV_NEW_IFSU52` |
| claude-haiku-4.5 | system only | `SYS_IFSU52` |
| claude-haiku-4.5 | developer only | `DEV_IFSU52` |
| claude-haiku-4.5 | aligned | `BOTH_IFSU52` |
| claude-haiku-4.5 | system then developer | `DEV_IFSU52` |
| claude-haiku-4.5 | developer then system | `SYS_IFSU52` |
| claude-haiku-4.5 | two developer messages across turns | `DEV_NEW_IFSU52` |

All Chat requests returned HTTP 200 with `finish_reason: stop`. The matrix consistently shows that developer instructions are accepted and that later high-authority messages win.

Native Messages controls confirmed top-level system instruction following, but combining conflicting instructions into one system block is not semantically equivalent to separate Chat system/developer roles and produced model-specific wording. No production change is justified.
