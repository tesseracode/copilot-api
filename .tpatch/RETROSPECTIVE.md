# Retrospective — architecture review, July 2026

Non-standard tracking file, companion to `POTENTIAL_FEATURES.md`. Records what an
architecture review of this repository turned up, and — more importantly for the tooling — what
the review revealed about gaps in `tpatch` itself.

Review performed 2026-07-25 against `16f1902` using the `improve-codebase-architecture` skill
(vocabulary: **module**, **interface**, **depth**, **seam**, **adapter**, **leverage**,
**locality**). Full HTML report was written to the OS temp directory, not committed.

---

## Part 1 — Findings in this repository

Six deepening candidates were surfaced. Status as of 2026-07-27:

| # | Candidate | Strength | Status |
|---|---|---|---|
| 1 | Put a seam under the two route handlers | Strong → **Worth exploring** | **coverage done**, seam deferred — `messages-handler-coverage` |
| 2 | Collapse the duplicated SSE pump | Strong | **done** — `sse-pump-consolidation` |
| 3 | Pull Anthropic→OpenAI translation out of the chat handler | Strong | **done** — `claude-chat-completions-passthrough` |
| 4 | Deepen tool-call assembly | Worth exploring | **rejected** — see below |
| 5 | Stop importing global `state` into deep internals | Worth exploring | **rejected** — see below |
| 6 | One error shape at the route seam | Speculative | **inverted → done** — `anthropic-error-envelope` |

Filed as deferred features while working through the above:
`claude-thinking-reasoning-text`, `streaming-response-discriminated-union`,
`stream-failure-visibility`.

Test count over the work: 202 → 238.

All six candidates were dispositioned. Four of the six were materially wrong as written — see
the rejections below and the note on candidate 6 — which is the single most transferable
finding of this review: the report was a good hypothesis generator and a poor decision-maker.
Every candidate needed measuring before acting.

### Where this document records decisions

Rejected candidates and their evidence are recorded here rather than as ADRs. The
`improve-codebase-architecture` skill expects `docs/adr/`, but this repository has none, and a
single section in the document that produced the candidates is lighter than establishing a new
convention. If this section grows past a handful of entries, promote it to real ADRs under
`docs/adr/` and leave pointers here.

### The headline measurement

`/v1/messages` and `/chat/completions` — the two primary product surfaces — were the only
routes never driven end to end by a test. `/health`, `/v1/pricing`, `/v1/embeddings`, and
`/responses` all were. All 202 tests landed on pure functions *beneath* the handlers, so every
routing, streaming, and abort decision was unverified. Candidate 3 shipped the first end-to-end
coverage of `/chat/completions`; `/v1/messages` still has none.

### Two live defects, both found by following the seam

Candidate 3 was filed as an architectural observation — translation logic living in a route
handler instead of the translation module — and the misplacement turned out to be load-bearing:

1. **Streaming tool calls were silently dropped.** `anthropicEventToOpenAIChunk` mapped only
   `text_delta` and `message_delta.stop_reason`; `content_block_start/tool_use` and
   `input_json_delta` returned `null`, while `finish_reason: "tool_calls"` was still emitted.
   Clients were told to expect a tool call whose name, id, and arguments never arrived.
2. **Client disconnects did not propagate.** `handleNativeReroute` called
   `forwardNativeMessages*` without the `AbortSignal` (both functions accept one) and had no
   abort catch, so aborted streams kept consuming Copilot quota. The
   `responses-stream-abort-propagation` feature had missed this path.

Both were fixed by deletion rather than repair — the reroute's rationale did not survive
measurement against the current upstream API.

### Lesson: verify a feature's premise before preserving it
`chat-completions-native-reroute` recorded, in its own `analysis.md`, *"Claude on
/chat/completions loses tool calling. Native /v1/messages passthrough preserves it."* Measured
directly against `api.githubcopilot.com` with `claude-sonnet-5`, upstream `/chat/completions`
preserves tool calls in both streaming and non-streaming modes, and still reports
`cache_read`/`cache_write`. The premise was either wrong when written or silently invalidated by
an upstream change. Nothing in the workflow would have caught either case.

This is the same failure mode as the stale model heuristics recorded in `CLAUDE.md`: assumptions
about a remote API frozen into code, with no mechanism to notice when the remote moves.

---

### Rejected candidates

#### Candidate 6 — one error shape at the route seam (inverted, then fixed)

The candidate proposed unifying error envelopes across all routes, on the observation that
three routes use `forwardError` and three hand-roll their own. Measuring what clients actually
receive showed unification would have been actively wrong: the two upstream contracts genuinely
differ. `/v1/messages` returns a top-level `type: "error"` plus a `request_id`;
`/chat/completions` returns `{"error":{"message","code"}}` with no top-level type. Forcing one
envelope would have broken the Anthropic contract to match the OpenAI one, and the embeddings
route's richer `type`/`code`/`param` body turned out to be the OpenAI error contract rather
than drift.

The real defect was the opposite and narrower: `/v1/messages` returned *two different shapes
depending on where the error originated* — correct when passing an upstream rejection through,
OpenAI-shaped whenever the proxy raised the error itself. Fixed by differentiating rather than
unifying, in `anthropic-error-envelope`. The candidate's framing was right — the route seam is
where the contract is known — even though its conclusion was backwards.

`token` and `usage` still return `{"error": "some string"}`. Left alone deliberately: private
routes, no SDK consumer, and folding them in would repeat the unify-everything instinct that
made the candidate wrong.

#### Candidate 4 — deepen tool-call assembly (rejected 2026-07-27)

**Do not re-suggest without new evidence.** A reviewer looking at
`src/services/copilot/create-responses.ts` will see the hottest file in the repository and a
stream state mutated by roughly seven functions, and will propose extracting the tool-call
assembler. That was proposed, measured, and rejected.

The candidate as written claimed the churn and the bugs concentrated in tool-call assembly.
They do not. Counting, per commit, how many changed lines actually touched tool-call code:

| April 2026 stability fix | tool-call lines changed |
|---|---|
| `63731b3` stable stream ids and `created` | 0 |
| `037b03e` terminal error events | 0 |
| `73cbb0b` abort propagation | 0 |
| `2104afc` tool_use_id validation | 0 |
| `0713ed4` argument divergence guard | 8 |

One of five, not four of five as the review originally asserted. Tool-call assembly's real
history is one substantial implementation (`d4a2fe0`, ~103 lines) followed only by small
touches (8, 7, 6 lines). That is code that stabilised, not code that keeps breaking. It is also
covered by four dedicated test files.

What the churn actually reflects is that `create-responses.ts` holds four unrelated concerns in
818 lines: request translation (~190), non-streaming response translation (~90), streaming
translation (~490), and the service call (~25). Every change to any one of them lands in the
same module.

Splitting the file along those lines was considered and also rejected, on the skill's own
terms: a file split changes no interface and makes nothing deeper. It is rearrangement, not
deepening, and the module's public surface is already small (six exports).

The two genuine weaknesses in this area — `POTENTIAL_FEATURES.md` #1, the delta-before-added
race, and #2, the `output_index` namespace collision — remain `latent` and `theoretical`
respectively, with no runtime evidence. That file's own rule is to promote an entry when
evidence flips from "could happen" to "happened". Neither has.

**Revisit if:** #1 or #2 acquires a real trigger (a log line, a user report, a failing test, or
an upstream event-ordering change), or if tool-call assembly starts absorbing changes again at
a rate comparable to the rest of the file.

#### Candidate 5 — stop importing global `state` into deep internals (rejected 2026-07-27)

**Do not re-suggest without new evidence.** Twenty-four non-test modules import a mutable
global singleton, which looks like textbook ambient coupling. Both concrete harms the candidate
rested on were measured and neither exists.

**Test leakage is structurally impossible, not merely absent.** The candidate noted that twelve
test files mutate the singleton and five never restore it. True, and irrelevant: `bun test`
gives each test file a fresh module registry. A sentinel written to `state` in one file is
invisible to the next, and `accountType` reads back as its default. Corroborated three further
ways — all 31 test files pass when run individually, and the full suite passes in normal order,
reverse order, and with the five non-restoring files forced first.

**There is no concurrency hazard.** Every write to the global is startup configuration
(`start.ts`, `auth.ts`), token lifecycle (`token.ts`), the model catalog cache (`utils.ts`), or
rate-limit timestamps (`rate-limit.ts`, deliberately cross-request). No per-request data is ever
written to it. Per-stream state is already passed as a parameter.

What remains is a design preference, and it cuts both ways. Threading state through 24 modules
widens every signature; the counter-argument — that required configuration is part of a
module's interface whether or not it appears in the signature, so making it explicit reveals
rather than widens — is fair. But with no defect, no test problem, and no concurrency risk, the
ledger is churn across 24 files of a working proxy against clarity alone.

**Revisit if:** per-request or per-connection data starts being written to the global, the
runtime changes to one that shares module state across test files, or a defect is traced to
ambient coupling.

**Taken instead:** `translateChunkToAnthropicEvents` and `isToolBlockOpen` in
`src/routes/messages/stream-translation.ts` named their `AnthropicStreamState` parameter
`state`, shadowing the well-known global. Lines like `state.contentBlockOpen = true` read as
global mutation from a hot streaming path — it briefly read that way during this review. Renamed
to `streamState`.

---

## Part 2 — Feedback for `tpatch` (v0.11.1)

Two gaps, both hit concretely during this work. Neither is a bug; both are missing concepts.

### 2.1 No first-class way to express that a feature supersedes another

**What happened.** `claude-chat-completions-passthrough` removes the mechanism that
`chat-completions-native-reroute` added. There is no way to say so. Both features remain
`applied` in `FEATURES.md`, which now asserts that two mutually exclusive mechanisms are
simultaneously live.

This is not a one-off. The same repository already contains the same situation:
`effort-model-suffix` (`applied`) had its mechanism removed by `api-context-effort-migration`
(`applied`). A reader of `FEATURES.md` cannot distinguish "this is how the code works" from
"this is how the code used to work". The only available workarounds are lossy:

- `tpatch remove <slug>` deletes the feature and its artifacts, destroying the record of why
  the mechanism existed and why it was abandoned;
- leaving it untouched preserves a claim that is now false;
- `tpatch amend --append` (what this repository did) records the supersession in prose, where
  no command can read it.

**Proposal.** A `supersedes` edge, modelled on the `depends_on` edge that
`tpatch amend --depends-on parent[:hard|:soft]` already implements:

```
tpatch add <slug> --supersedes <parent>
tpatch amend <slug> --supersedes <parent>
```

With that edge, `tpatch` could: render superseded features distinctly in `FEATURES.md` (e.g. a
`superseded` state or a `superseded-by` column); exclude them from reconcile's forward-apply
pass, since re-applying a superseded patch is never correct; and let `tpatch status` answer
"what is actually live right now?" — which today requires reading prose.

The annotation this repository hand-wrote onto `chat-completions-native-reroute` is a
reasonable starting schema for what the edge should carry: what superseded it, when, and the
evidence that invalidated the original rationale.

### 2.2 Recipe replay can silently revert later fixes

**What happened.** `scripts/proxy-model-validation.ts` contained an import of an absolute,
machine-local path that was never committed. That was fixed in `stabilize-copilot-api`. But
`.tpatch/features/responses-replay-id-validation/artifacts/apply-recipe.json` contains a
`write-file` operation carrying a full 28 KB copy of that same file — including the broken
import. Re-executing that recipe would have silently reverted the fix and reintroduced a
build-breaking path, with no warning.

The root cause is that `write-file` recipes embed whole-file snapshots frozen at authoring
time, while the file keeps evolving under later features. The existing guidance —
*"when the patch and recipe disagree, trust the patch"* — correctly identifies the hazard for
`replace-in-file` anchors that no longer match, but a `write-file` op never fails to apply. It
succeeds and quietly overwrites.

**Proposal.** Any of these would have surfaced it:

- record a content hash of each `write-file` target at authoring time and refuse (or warn) on
  `apply --mode execute` when the file on disk no longer matches the expected pre-state;
- have `tpatch verify` flag recipe operations whose target file has been modified by a
  later-recorded feature — the ownership information already exists in the feature index;
- prefer `replace-in-file` over whole-file `write-file` when deriving recipes from a captured
  patch, so drift surfaces as a failed anchor rather than a silent overwrite.

The general principle: a recipe operation that cannot fail is more dangerous than one that can.

### 2.3 Smaller observations

- `tpatch record <slug>` on an already-committed feature silently captures only the working
  tree, which regenerates the recipe down to whatever remained uncommitted. `--from <base>` is
  documented, but the failure is quiet — the recipe simply shrinks. A warning when the captured
  patch is a strict subset of the existing recipe's file set would help. (Encountered while
  recording `stabilize-copilot-api`; noted in `CLAUDE.md`.)
- Path B (`--manual`) worked well and is well documented, but nothing in the artifacts records
  *that* a phase was agent-authored rather than provider-generated. For auditing why a spec
  looks the way it does, that provenance would be useful.
