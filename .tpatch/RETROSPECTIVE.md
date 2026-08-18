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
`claude-thinking-reasoning-text` and `streaming-response-discriminated-union`.
`stream-failure-visibility` was subsequently mutation-tested, implemented, independently reviewed,
and shipped in `bfd8f16` — see Part 3.

Test count over the architecture review: 202 → 238. The follow-up stream-failure work increased it
to 241.

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

Filed upstream as [tesseracode/tesserapatch#1](https://github.com/tesseracode/tesserapatch/issues/1).

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

---

## Part 3 — Implementation workflow retrospective: stream-failure visibility

`stream-failure-visibility` was the first deferred finding taken through the full workflow after
this architecture review. It shipped as `bfd8f16` and passed CI in
[run 30374896447](https://github.com/tesseracode/copilot-api/actions/runs/30374896447).
The test suite grew from 238 to 241 tests during the work.

### 3.1 Test the absence before writing the mechanism

The existing characterization said a non-abort transport failure produced partial HTTP 200 SSE
followed by clean EOF. The first implementation step inverted that characterization into a
requirement for one terminal Anthropic error event and ran it against unchanged production code.
It failed at exactly the new assertion: partial `message_start` data was present, but
`body.match(/event: error/g)` was `null`.

That failure mattered more than a new test that began green. It proved the test observed the
missing client-visible behavior rather than merely exercising the setup. This is the preferred
sequence for future bug fixes:

1. turn observed bad behavior into a failing assertion;
2. run it against unchanged code;
3. only then add the mechanism;
4. break the mechanism deliberately and confirm the assertion fails again.

### 3.2 Mutation tests caught what a green suite could not

Two one-hunk production mutations were run after implementation:

- replace `await onError(stream, error)` with a no-op;
- replace native Responses terminal-error enqueue with a direct close.

The corresponding Anthropic and Responses regressions both failed, and both passed after only the
exact mutated hunk was restored. The commands and failure evidence live in
`stream-failure-visibility/artifacts/mutation-test.md`.

This was not ceremonial. Earlier in the architecture review, six tests passed against deliberately
broken helpers. A green test is evidence only after a plausible fault makes it red. Mutation tests
should remain focused on the behavior boundary rather than broad source transformations: they are
cheap, reviewable, and safe to restore exactly.

### 3.3 Independent reviewers found convergent defects

Three read-only reviewers examined the completed feature from different perspectives:

- defensive security;
- external-client protocol/UX compatibility;
- code quality and lifecycle correctness.

Their useful findings converged rather than merely producing stylistic preferences:

- raw substring matching could let provider/user text spoof an in-band error and suppress the real
  terminal transport error;
- a pre-aborted signal or a pending `reader.read()` was not actively cancelled;
- an in-band provider error followed by transport failure could emit a duplicate synthetic error;
- successful native bytes needed exact fidelity coverage;
- OpenAI Chat needed a route-level assertion for its precise SSE error envelope and EOF semantics;
- detailed exception values should not be logged at the terminal boundary;
- the first test rewrite had weakened existing `isNonStreaming`/abort helper coverage.

The resulting changes used parsed SSE frames, active reader cancellation, exactly-once terminal
state, sanitized logs, byte-for-byte success tests, exact OpenAI/Anthropic/Responses error-shape
tests, and restored all prior helper assertions. The final contracts are:

- client aborts remain silent;
- non-abort transport failures produce one format-correct terminal error;
- no fake `[DONE]`, `message_stop`, or success finish reason follows an error;
- in-band provider errors are not duplicated;
- successful native Responses bytes are unchanged;
- pending upstream reads are cancelled when the downstream disconnects.

### 3.4 Reviewer isolation can make correct reviews irrelevant

Some review agents initially inspected clean worktrees created from `HEAD`, while the feature was
still uncommitted in the primary working tree. Their reports described older files or unrelated
changes and were not actionable. The fix was to tell reviewers explicitly to inspect the primary
working tree and list the exact dirty paths.

For uncommitted review work:

- isolated worktrees are useful only when the candidate changes are committed or supplied as a
  complete diff;
- otherwise point the reviewer at the primary path and scope exact files;
- verify every finding against the current diff before editing;
- treat a reviewer report that does not mention the changed symbols as stale evidence.

This is a general tool-usage lesson, not a limitation of parallel review itself. Parallel reviewers
were valuable once they were looking at the same artifact.

### 3.5 tpatch recorded the result, but process evidence is still mostly prose

Path B cleanly recorded the feature, dependencies, generated patch, tests, and mutation artifact.
The dependency graph correctly places it after `sse-pump-consolidation` and alongside
`responses-stream-error-events`.

The feature artifacts can show *what* changed and the mutation document can show selected commands,
but tpatch still does not natively model:

- reviewer roles and findings;
- accepted versus rejected review recommendations;
- a mutation-test phase or its expected-failure result;
- provenance that analysis/spec/exploration were authored through Path B;
- CI confirmation after push.

Those gaps do not block the workflow, but they explain why this Part 3 and the mutation artifact
are necessary. A future tpatch review/verification model could make this evidence structured rather
than relying on retrospective prose.

---

## Part 4 — Workspace cleanup, August 2026

Cleanup of the lifecycle and metadata debt left by the July review. Two items were resolved, one
was found to be un-backfillable, and one turned out to be a much larger pre-existing condition.

### Resolved

**Stale requested features rejected.** `claude-developer-instruction-preservation` and
`reasoning-roundtrip` were both moved to `rejected` with `--reason premise-disproved`, each with its
own `request.md` recorded as content-hashed evidence. The first was disproved by live measurement
showing Claude Chat passthrough already preserves developer instructions. The second was disproved
on two counts: the malformed empty-ID reasoning item cannot originate from the current
`/v1/messages` path, and its stated blocker ("Copilot must populate summaries") is stale — the real
obstacle is that Anthropic history has no safe representation for a provider-issued opaque reasoning
ID, its encrypted content and its provenance.

**D7 recipe schema drift cleared (8 features).** Legacy `apply-recipe.json` files carried a
`"version": 1` key the current schema rejects. Removing it and adding the `feature` key cleared all
eight findings. The re-serialization expanded some single-line operations, but the operation types,
paths and search/replace strings are byte-identical.

### D2 cannot be backfilled honestly (24 features)

`patch-generations.json` is missing for 24 pre-manifest features. Doctor recommends
`tpatch feature patch refresh <slug>`, but that command **skips when the patch bytes are unchanged**
("no patch byte change; refresh skipped") and therefore never creates the manifest. The only ways to
force it would be to alter historical patch bytes or to re-record against the current tree, both of
which would corrupt patches that are otherwise intact.

Hand-authoring the manifests was rejected as worse than the gap. The schema carries
`base_commit`, `git_patch_id`, and `capture.mode`/`pathspecs` — provenance that was never recorded
for these features and cannot be reconstructed. Synthesizing it would make an audit trail look
authoritative while being invented. **Accept D2 as legacy drift**: it means only that generation
history is unavailable for pre-manifest features, which is simply true.

### `tpatch verify --all` fails 53 of 56 — pre-existing and structural

Discovered during this cleanup, not caused by it. `health-endpoint`, untouched for months, fails
`post_apply_patch_replay_clean` exactly like the rest, which dates the condition well before the
August work.

The cause is that this fork's patches are cumulative. Each feature was recorded against the tree as
it existed at the time, so replaying the stack from a clean upstream baseline fails once a later
feature has touched the same file — the same overlap the `later-touch` warnings report on nearly
every record. Two failure shapes dominate: `post_apply_patch_replay_clean` (the canonical patch no
longer applies to a closure-replayed baseline) and `recipe_replay_clean` (an old recipe's
`replace-in-file` anchor no longer exists, e.g. `responses-stream-arg-divergence-guard` against
`create-responses.ts`).

This does not indicate broken features. Every patch recorded in this session round-tripped cleanly
against the working tree, and the repository's own gates — typecheck, lint, 352 tests, build — pass.
It reflects the documented model that **the patch captures intent and the recipe is a point-in-time
script**; when they disagree, the patch wins.

Restoring a clean `verify --all` would mean re-recording the entire stack in dependency order
against a fresh upstream baseline. That is a migration with real risk of losing or reordering intent,
and it should be a deliberate decision with its own feature, not a side effect of metadata cleanup.
Until then, treat `verify --all` as informational and rely on the per-feature round-trip validation
that `tpatch record` already performs.

---

## Part 5 — Report for the `tpatch` team (v0.15.1)

Written to be sent as-is. All figures were measured on 2026-08-17 against `tpatch v0.15.1` in
`tesseracode/copilot-api`, a long-lived fork with **56 tracked features** on a cumulative stack.

### Context: what this repository looks like

This is not a greenfield workspace. Features have accumulated over roughly five months, and many of
them modify the same files — `README.md`, `src/services/copilot/create-responses.ts`,
`src/start.ts`, `src/routes/models/route.ts`. Each feature's canonical patch was recorded against
the tree as it existed at the time. The repository itself is healthy: `bun run typecheck`,
`bun run lint:all`, 352 tests and `bun run build` all pass, and every patch recorded during the
August work reported `Patch validated: round-trips cleanly against working tree`.

### Finding 1 — `verify --all` reports zero passing features on a healthy repository

```
Summary: 0 passed, 53 failed, 3 skipped, 0 error
```

Failing blocking checks, aggregated:

| Check | Failures |
| ----- | -------- |
| `post_apply_patch_replay_clean` | 38 |
| `recipe_replay_clean` | 16 |
| `write_file_preimage_fresh` | 6 (now 2 — see Finding 2) |
| `intent_files_present` | 1 |

Because **no** feature passes, the signal carries no discriminating information — a genuinely broken
feature would be indistinguishable from the other 52. This is pre-existing and not the result of
recent work: `health-endpoint` has been untouched for months and fails `post_apply_patch_replay_clean`
identically.

The root cause appears to be that closure replay assumes a stack that can be rebuilt from a clean
upstream baseline, whereas a cumulative fork's later patches legitimately depend on earlier ones
having already materialized.

**Ask:** a verification mode for cumulative stacks — for example validating each patch against its
own recorded base commit rather than a closure-replayed baseline — or an explicit statement that
`verify --all` is only meaningful for stacks maintained in re-recordable form, plus a documented
procedure for converting an existing repository into that form.

### Finding 2 — Path B never emits `recipe-provenance.json`, so V10 cannot pass *(corrected)*

**This finding was originally reported incorrectly and is retained here with its correction, because
the mistake is itself instructive.** We first claimed six features failed `write_file_preimage_fresh`
because their `preimage_hash` values had gone stale when a sibling touched the same shared file. The
tpatch team responded that the recent failures were "missing Path B provenance, not stale hashes; all
11 preimages match their recorded bases". They were right, and we had not measured before reporting.

Verifying all 14 non-new preimages across our six recent features against the `base_commit` recorded
in each `patch-generations.json` produced **zero mismatches**. The actual check message is:

```
✗ [block] write_file_preimage_fresh — recipe op #1 src/lib/build-info.ts carries a preimage_hash
but artifacts/recipe-provenance.json is absent; verify will not evaluate a preimage against the
live working tree
```

The real gap is that `tpatch implement --manual` does not write `artifacts/recipe-provenance.json`,
while the Path A provider flow does — only 5 of 56 features had one. Since Path B is documented as a
first-class workflow, any hand-authored recipe carrying `preimage_hash` values fails V10 permanently,
regardless of how correct those hashes are.

We backfilled the sidecar for eight features. Two of its three fields came from tpatch's own
authoritative records — `base_commit` and `recipe_sha256` from `patch-generations.json`, with the
recorded `recipe_sha256` verified byte-for-byte against the current recipe — and `generated_at` was
anchored to the commit that first added the recipe. V10 failures dropped from 6 to 2, and the first
feature in this repository's history began passing `verify`.

The two remaining V10 failures are older features reporting `landing evidence ... is malformed`,
which is downstream of `recipe_replay_clean` rather than of provenance.

**Ask:** have `tpatch implement --manual` write `recipe-provenance.json` exactly as the provider path
does. Path B is otherwise complete, and this single omission makes a blocking check unreachable for
every hand-authored recipe.

**Process note for us:** we reported an inference as a measurement. The correction cost the tpatch
team a round trip, and the same discipline we apply to feature premises must apply to bug reports we
file.

### Finding 3 — D2 findings are not backfillable with any current command

24 pre-manifest features lack `artifacts/patch-generations.json`. Doctor's remediation is
`tpatch feature patch refresh <slug>`, which does not work:

```
$ tpatch feature patch refresh anthropic-beta-1m-detection --reason "backfill missing manifest"
no patch byte change; refresh skipped
```

Refresh short-circuits when patch bytes are unchanged, so the manifest is never written. The only
ways to force it would be to alter historical patch bytes or re-record against the current tree,
both of which would corrupt patches that are currently intact.

Hand-authoring was rejected deliberately: the schema carries `base_commit`, `git_patch_id` and
`capture.mode`/`pathspecs` — provenance that was never recorded for these features and cannot be
reconstructed. Writing plausible values would make an audit trail look authoritative while being
invented, which is worse than the gap.

**Ask:** a first-class backfill — for example `tpatch feature patch adopt <slug>` — that creates a
generation record from the existing patch bytes and marks the unknown provenance fields explicitly
as unknown, rather than requiring either fabrication or a byte change.

### Finding 4 — schema changes shipped without an automatic fixer

Eight features carried `"version": 1` in `apply-recipe.json`, which the current
`workflow.ApplyRecipe` schema rejects as an unknown field. Doctor reported them (D7) but offered only
"hand-fix ... or regenerate with `tpatch implement`" — and regenerating would have replaced recorded
intent with a freshly generated recipe.

The fix was mechanical: delete one key, add `feature`. We scripted it and all eight cleared. Compare
with D3 (stale skill assets), where `tpatch doctor --fix --check D3` handled the migration
automatically and worked well.

**Ask:** treat recipe-schema evolution the same way as asset drift — ship `doctor --fix` support for
mechanical schema migrations, so a version bump does not require every downstream repository to
hand-edit historical artifacts.

### Finding 5 — `later-touch` warnings have no resolution path

Nearly every record on this repository emits warnings of the form:

```
⚠ later-touch warning: [<feature>] touches README.md which is whole-file-owned by older
active feature "<other>"; this recipe may supersede or invalidate that older write-file
(PRD-write-file-recipe-safety §4.2, ADR-029 D6)
```

We responded by declaring hard dependency edges for every reported owner, which is the correct
modelling and keeps `tpatch feature deps --validate-all` at `DAG: ok (0 violations)`. But declaring
the edge does not clear the warning, and does not affect the corresponding verify failure, so there
is no way to reach a clean state or to distinguish "acknowledged and modelled" from "unexamined".

**Ask:** let a declared dependency edge acknowledge the overlap, or provide an explicit
acknowledgement mechanism, so the warning highlights genuinely unmodelled overlaps.

### Evidence

| Claim | Where to look |
| ----- | ------------- |
| Cumulative stack, dependency modelling | `.tpatch/features/*/status.json` (`depends_on`) |
| Recent features with stale preimages | `.tpatch/features/expose-a-stable-non-secret-copilot-api-translation-contract/artifacts/apply-recipe.json` and the three siblings named above |
| Legacy recipes lacking manifests | the 24 features without `artifacts/patch-generations.json` |
| A well-formed manifest for comparison | `.tpatch/features/expose-a-stable-non-secret-copilot-api-translation-contract/artifacts/patch-generations.json` |
| D7 schema fix applied | commit `578d189` |
| Repository health despite verify failures | CI gates in `AGENTS.md`; `bun test` → 352 pass |
| Prior feedback round | Part 2 of this document (v0.11.1) |

### Summary of asks

1. A verification mode, or documented migration procedure, for cumulative forks.
2. Have `tpatch implement --manual` write `recipe-provenance.json`, as the provider path does.
3. A backfill command for pre-manifest features that records unknown provenance honestly.
4. `doctor --fix` support for mechanical recipe-schema migrations.
5. A way for a declared dependency edge to acknowledge a later-touch overlap.

Item 2 is small and fully diagnosed; fixing it took this repository from 0 to 1 passing feature
after we backfilled the sidecar by hand. Item 1 is the blocking one, and item 5 is the strategic
one: together they are why `verify --all` still reports 52 failures on a repository whose own gates
are green.
