# Tessera Patch Case Study: Three-Tier Routing for copilot-api

**Date**: 2026-04-26
**Project**: copilot-api (fork of ericc-ch/copilot-api)
**Methodology**: tpatch Path B (implement first, record after)
**Stress test**: 5 cosmetic features × 5 models × 3 routing tiers

---

## Part 1: Quality Audit of Generated Artifacts

We ran `tpatch cycle` on 5 cosmetic features, each driven by a different LLM model routed through 3 different upstream API tiers. Here's what the models actually produced:

### Feature 1: hide-internal-models (claude-sonnet-4.6 via /v1/messages)

**Quality: Excellent**

- **Analysis**: Correctly identified all 4 affected files. Raised genuine unresolved questions (case sensitivity, env var support, whether to also filter in routing).
- **Spec**: 10 acceptance criteria, each testable. Included env var override (`HIDE_INTERNAL_MODELS=true`) with CLI precedence — a thoughtful addition.
- **Exploration**: Correct minimal changeset. Code snippets match the codebase's actual patterns.
- **Recipe**: 9 operations. Created `filter-models.ts` with proper generics, added state field, registered CLI flag, wired into route handler, even wrote tests. Import paths use the project's `~/` alias convention correctly.
- **Hallucinations**: Zero. Every file path, import, and search string references real code.
- **Verdict**: Production-ready. Could execute this recipe and ship it.

### Feature 2: log-model-display-name (gpt-5.5 via /responses)

**Quality: Very Good — slightly over-engineered**

- **Analysis**: Thorough. 7 acceptance criteria, 8 implementation notes. Correctly identified `request-logger.ts` as the target and `state.models` as the cache source.
- **Spec**: 13-step implementation plan. Extremely detailed — almost too detailed for a logging enhancement. But every point is technically sound.
- **Exploration**: Listed 12 relevant files (some unnecessary, like `proxy.ts`). Minimal changeset section is 10 steps — more like a tutorial than a changeset.
- **Recipe**: 8 operations. Created a standalone `model-display-name-cache.ts` with `Map<string, string>` cache, update/clear/get functions. Wrote comprehensive tests including malformed data and OpenAI-style response objects.
- **Hallucinations**: **Yes — minor.** The recipe references `import { getCopilotToken } from "./auth"` in `get-models.ts` — this import doesn't exist. Also references `cachedModels = models` and `cachedModels = data` patterns that don't exist in the file. The `replace-in-file` search strings would fail on apply.
- **Verdict**: The core design (cache + lookup helper + tests) is solid. The recipe wouldn't apply cleanly due to hallucinated search strings, but the architecture is correct. A human could implement from the spec in 15 minutes.

### Feature 3: model-vendor-filter (gemini-2.5-pro via /chat/completions)

**Quality: Poor — hallucinated the entire codebase**

- **Analysis**: Good conceptual analysis. Correctly identified the need for CLI flag + state + route filter.
- **Spec**: Reasonable acceptance criteria.
- **Exploration**: Not examined (the recipe tells the story).
- **Recipe**: 4 operations. **Completely hallucinated.** References:
  - `export interface Config { port: number; host: string; }` — doesn't exist in `state.ts`
  - `MODEL_FAMILIES` array with GPT-4 Turbo, Claude 3 Opus, Gemini Pro pricing data — **none of this exists anywhere in the codebase**
  - `import { MODEL_FAMILIES } from '../../lib/model-mapping'` — this export doesn't exist
  - Express-style `import { Hono } from 'hono'` mixed with completely wrong handler patterns
- **Verdict**: The analysis understood the task, but the implement phase fabricated an imaginary codebase. The recipe is useless — it would fail on every `replace-in-file` operation. Gemini hallucinated a generic model-registry project instead of reading the actual code.

### Feature 4: startup-model-count (gpt-5.4 via /responses — timeout)

**Quality: N/A — implement phase timed out**

- **Analysis**: Solid. Correctly identified `src/start.ts`, `src/main.ts`, `src/server.ts` as candidates.
- **Spec**: 6 good acceptance criteria including edge case (zero models).
- **Exploration**: Not generated (timeout).
- **Recipe**: Heuristic fallback — just `ensure-directory src/`. Useless.
- **Verdict**: The analysis and spec are good, but the model couldn't complete the implement phase within the timeout. This is a model performance issue, not a routing issue — the proxy successfully forwarded the request.

### Feature 5: health-endpoint (claude-haiku-4.5 via /v1/messages)

**Quality: Mixed — good structure, wrong framework assumptions**

- **Analysis**: Correct. Identified all relevant files. Good acceptance criteria.
- **Spec**: Well-structured with clear acceptance criteria.
- **Recipe**: 11 operations. Created `uptime.ts`, `version.ts`, `model-counter.ts`, route handler, unit tests, integration tests.
- **Hallucinations**: **Significant framework mismatch.**
  - Route handler uses `import { Request, Response } from 'express'` — the project uses **Hono**, not Express
  - Tests use `import { describe, it, expect } from 'vitest'` — the project uses **bun:test**
  - Tests use `import request from 'supertest'` — not in dependencies
  - References `import { getAvailableModels } from '~/lib/model-mapping'` — this function doesn't exist
  - Appends commented-out code to `endpoint-routing.ts` and `main.ts` instead of actual wiring
- **Verdict**: The decomposition into uptime/version/counter modules is sensible architecture. But Haiku didn't recognize Hono or Bun and fell back to Express/Vitest defaults. The recipe would not compile. A human could salvage the design in ~20 minutes by porting to Hono.

---

## Part 2: Quality Summary

| Feature | Model | Tier | Analysis | Spec | Recipe | Would Apply? |
|---------|-------|------|----------|------|--------|-------------|
| hide-internal-models | claude-sonnet-4.6 | `/v1/messages` | Excellent | Excellent | 9 ops, correct | **Yes** |
| log-model-display-name | gpt-5.5 | `/responses` | Very Good | Very Good | 8 ops, minor halluc. | **Partial** — 3/8 ops would fail |
| model-vendor-filter | gemini-2.5-pro | `/chat/completions` | Good | Good | 4 ops, all halluc. | **No** — fabricated codebase |
| startup-model-count | gpt-5.4 | `/responses` | Good | Good | Timeout/heuristic | **No** — no recipe generated |
| health-endpoint | claude-haiku-4.5 | `/v1/messages` | Good | Good | 11 ops, wrong framework | **No** — Express/Vitest, not Hono/Bun |

### Model Quality Ranking (for code generation via tpatch)

1. **Claude Sonnet 4.6** — Best by far. Zero hallucinations, correct imports, correct patterns, production-ready recipe.
2. **GPT-5.5** — Good architecture, good tests, but hallucinated some file internals. Recipe partially applicable.
3. **Claude Haiku 4.5** — Correct decomposition but wrong framework (Express instead of Hono). Analysis/spec phases were solid.
4. **GPT-5.4** — Timeout on implement. Analysis/spec were good but we can't evaluate code quality.
5. **Gemini 2.5 Pro** — Completely fabricated the codebase during implement. Analysis was fine but the recipe is fiction.

---

## Part 3: Taking Over — Bringing LLM Output to Production

After the stress test, we took all 5 features from their LLM-generated state to production quality. This phase tested tpatch's workflow for adopting, fixing, and reconstructing features that didn't generate cleanly.

### What actually happened when we tried to apply

**hide-internal-models (Sonnet 4.6 — "would ship"):**
`tpatch apply --mode execute` ran 9 operations: **4 passed, 5 failed.** The `write-file` operations and `state.ts` modifications applied cleanly. The failures were all `replace-in-file` operations on `main.ts` and `route.ts` — the search strings assumed different import styles (`../../lib/state` vs `~/lib/state`) and that `main.ts` has inline arg parsing (it uses citty subcommands). The *logic* was correct but the *literal string matching* broke on import path conventions and framework patterns.

**Takeaway**: Even the "best" recipe was only 44% auto-applicable. The `replace-in-file` format is the bottleneck — it demands exact byte-level accuracy from an LLM that's working from memory of files it read once.

### Recovery workflow for each failure mode

| Failure Mode | Example | Recovery Path | tpatch Phase Used |
|-------------|---------|---------------|-------------------|
| Recipe partially applies | hide-internal-models | Fix failed ops manually, record | `apply --execute` → manual fix → `record --from` |
| Good spec, bad recipe | log-model-display-name | Implement from spec, ignore recipe | Read spec → manual implement → `record --from` |
| Hallucinated recipe | model-vendor-filter | Rewrite from scratch using analysis as context | Read analysis → manual implement → `record --from` |
| Timeout / no recipe | startup-model-count | Implement from spec (1-line change) | Read spec → manual implement → `record --from` |
| Wrong framework | health-endpoint | Port design to correct framework | Read recipe for architecture → rewrite in Hono → `record --from` |

### What was useful from each feature's artifacts

Even when the recipe was garbage, earlier phases had value:

- **Analysis**: Useful in 5/5 cases. Correctly identified affected files and raised real design questions every time, regardless of model.
- **Spec**: Useful in 4/5 cases. Acceptance criteria guided manual implementation. Only Gemini's spec was too generic to be actionable.
- **Exploration**: Useful in 2/5 cases. Sonnet's exploration was precise. Others were too broad or redundant with the spec.
- **Recipe**: Useful in 1/5 cases (Sonnet's, partially). The others ranged from "good architecture document" to "fantasy novel."

### The actual implementation flow

For all 5 features, the actual flow was:

1. Read the LLM-generated analysis and spec for context
2. Ignore the recipe (except Sonnet's `write-file` outputs which were correct)
3. Implement manually using the spec as acceptance criteria
4. Run `bun test` and `npx tsc --noEmit` to verify
5. `tpatch record <slug> --from <base-commit>` to capture the diff

Time to implement all 5 features manually: **~25 minutes** (including the `output_config` fix discovered along the way).

### Bonus bug found during takeover

While implementing, Claude Code sent a request with `output_config: { effort: "high" }` through the native `/v1/messages` passthrough. The Copilot API rejected it: `"output_config: Extra inputs are not permitted"`. This revealed that our passthrough was blindly spreading the payload (`{ ...payload }`) instead of whitelisting supported fields.

**Fix**: Rewrote `forwardNativeMessages` to explicitly whitelist Anthropic API fields. This is the kind of integration bug that only surfaces under real usage — and it only surfaced because we were *using* the proxy to drive the stress test.

---

## Part 4: tpatch Workflow Assessment

### Were the metadata validation tools useful?

**`tpatch status`**: Yes — instant visibility into which features exist and their state. When we came back to adopt the stress test results, `tpatch status` showed all 5 features in `[implementing]` state, making it clear what needed attention.

**`tpatch next`**: Somewhat useful. It correctly told us the next phase, but in Path B (manual implementation), you already know what comes next. More useful for Path A workflows.

**`tpatch apply --mode execute`**: Very useful as a **validation tool**, even when it fails. Running it against hide-internal-models showed exactly which operations would work and which wouldn't — a faster feedback loop than manually diffing the recipe against the codebase.

**`tpatch record --from`**: Essential. This is the Path B workhorse. Every feature ended up going through this, regardless of how it was implemented. Simple, reliable, no surprises.

**`tpatch cycle`**: Useful for stress testing and generating specs, but the end-to-end success rate (1/5 recipes fully applicable) means it's better as a "generate starting artifacts" tool than a "generate working code" tool.

### How easy was it to take over from the LLM-generated work?

**Easy, because tpatch separates intent from implementation.**

The key insight: when an LLM generates a bad recipe, the *analysis* and *spec* survive. These earlier artifacts capture the *intent* of the feature — what it should do, which files are involved, what the acceptance criteria are. The recipe is just one (often broken) attempt at realizing that intent.

Taking over meant:
1. Read the analysis (30 seconds) — understand the scope
2. Read the spec (1 minute) — understand the acceptance criteria
3. Ignore the recipe — implement yourself
4. Record — `tpatch record` captures your implementation with the original intent metadata intact

This is fundamentally different from taking over a half-finished PR or a stale branch. A PR says "here's some code" — you have to reverse-engineer the *why*. tpatch's artifacts preserve the *why* even when the *how* is wrong.

### The lifecycle we actually used

```
Request → [LLM: analyze] → [LLM: define] → [LLM: explore] → [LLM: implement]
                                                                    ↓
                                                              Recipe fails
                                                                    ↓
                                                         Human reads spec
                                                                    ↓
                                                       Human implements
                                                                    ↓
                                                         tpatch record
                                                                    ↓
                                                              [applied]
```

This is a hybrid Path A→B workflow: use the LLM for the thinking phases (analyze, define, explore), fall back to human for implementation, then record. It worked better than pure Path A (LLM can't reliably generate recipes) and better than pure Path B (human benefits from the structured analysis).

---

## Part 5: Is tpatch a good methodology?

### What tpatch actually is

Having used it hands-on for a real feature (three-tier routing) and then stress-tested it with 5 LLM-driven cycles, here's what tpatch is and isn't:

**It is NOT just a git wrapper.** Git tracks *what* changed. tpatch tracks *why* something changed, *what it was supposed to do*, and *how to re-apply it when upstream moves*. The difference matters:

- `git diff` tells you "line 42 changed from X to Y"
- tpatch tells you "we added endpoint routing because upstream only supports /chat/completions, here's the spec, here's the analysis, here's the recipe to re-derive the change, and here's the patch to re-apply if the recipe breaks"

**It is NOT just "keeping forks up to date."** That's the pitch on the website, but it undersells the tool. The real value is the **structured feature decomposition** — the forced progression through analyze → define → explore → implement → apply → record. Even when the LLM generates garbage (Gemini's hallucinated codebase), the *analysis* and *spec* phases were still useful because they forced structured thinking about the feature.

**It IS "git with intent"** — and that's a better framing. Every patch has provenance: why it exists, what it should do, how to verify it, and how to re-derive it. This is the metadata git doesn't capture.

### What worked well

1. **Path B (implement first, record after)** is the practical path. We implemented the three-tier routing by hand, tested it, fixed bugs iteratively, then recorded. The tpatch artifacts became documentation rather than generation — which is arguably more valuable.

2. **The phase structure caught real issues.** The stress test revealed:
   - `/v1` health check route missing (tpatch's provider check found it)
   - `temperature` parameter unsupported on `/responses` API (tpatch's LLM calls triggered it)
   - `/v1/v1/` double-prefix bug (base_url misconfiguration)
   - `output_config` passthrough bug (real Claude Code request rejected by Copilot)
   
   These are integration issues we wouldn't have found with unit tests alone.

3. **Compatibility reports as artifacts.** The 24-model compatibility matrix lives alongside the feature as a tpatch artifact. When upstream changes, the reconciliation process can re-run these tests.

4. **Feature isolation.** Each feature gets its own directory with analysis, spec, exploration, recipe, and patches. This is much better than a monolithic CHANGELOG.

5. **Taking over is clean.** When an LLM generates a bad recipe, the earlier artifacts (analysis, spec) survive and provide context. `tpatch record --from` lets a human implementation slot into the same tracking structure seamlessly.

### What didn't work well

1. **LLM quality variance is extreme.** Claude Sonnet 4.6 produced a production-ready recipe. Gemini fabricated an entire codebase. Same tool, same prompts, wildly different results. tpatch's value proposition depends heavily on which model drives it.

2. **The implement phase is fragile.** `replace-in-file` with literal string matching means the LLM must reproduce exact code from the file — including whitespace. 4 out of 5 models failed to do this reliably. The recipe format is deterministic but the LLM generation isn't.

3. **Path A (LLM-driven) requires a strong model.** Only Claude Sonnet 4.6 produced a partially-applicable recipe. For smaller/weaker models, Path B (human implements, tpatch records) is the only viable path.

4. **Config is single-model.** Running parallel stress tests was impossible because `config.yaml` only holds one model. We had to run sequentially, which took ~7 minutes instead of ~2.

5. **`tpatch apply --execute` is all-or-nothing per operation.** When 4/9 operations succeed and 5 fail, you get a partially-modified working tree. The tool correctly reports which failed, but there's no `--continue` or `--skip` mode to interactively handle failures.

### Is it worth the hassle?

**For active forks: yes.** If you're maintaining a fork with 3+ custom features and upstream updates regularly, the reconciliation value alone justifies tpatch. Without it, you're doing `git rebase` and hoping. With it, you have structured patches with intent metadata that can be re-evaluated.

**For one-off patches: maybe not.** If you're making a single change to a fork you'll never update, tpatch's ceremony (6 phases, multiple artifacts) is overkill. Just make the change and commit.

**For LLM-driven development: use the hybrid path.** Let the LLM handle analyze/define/explore (it's good at structured thinking), do the implementation yourself (Path B), then record. You get the best of both: structured intent metadata from the LLM, reliable code from a human.

### Positioning recommendation

Don't call it "a tool to keep your forks up to date" — that's the *mechanism*, not the *value*.

Don't call it "git with intent" — that's closer but sounds like a git plugin.

Call it what it is: **"structured patch management for customized forks."** The value is that every customization has:
- A *reason* (analysis + spec)
- A *recipe* (deterministic re-derivation)
- A *patch* (fallback when the recipe breaks)
- A *reconciliation path* (when upstream moves)

No other tool gives you all four.

---

## Appendix A: Routing Tier Validation

The stress test validated all 3 routing tiers under real LLM workloads:

| Tier | Endpoint | Models Tested | Multi-turn Conversations | Result |
|------|----------|--------------|------------------------|--------|
| Native Anthropic | `/v1/messages` | claude-sonnet-4.6, claude-haiku-4.5 | 4 phases × 2 models = 8 calls | All passed |
| Responses API | `/responses` | gpt-5.5, gpt-5.4 | 4 phases × 2 models = 8 calls | 7 passed, 1 timeout |
| Chat Completions | `/chat/completions` | gemini-2.5-pro | 4 phases × 1 model = 4 calls | All passed |

Total: **20 LLM API calls** across 3 routing tiers, **19 successful**, **1 timeout** (model performance, not proxy failure).

## Appendix B: Integration Bugs Discovered

| Bug | How Discovered | Fix |
|-----|---------------|-----|
| `/v1` health check 404 | tpatch provider connectivity check | Added `GET /v1` route |
| `/v1/v1/` double prefix | Server logs showed malformed path | Fixed tpatch `base_url` config (no `/v1` suffix) |
| `temperature` rejected on `/responses` | GPT-5.x implement phase returned 400 | Strip `temperature`/`top_p` from `/responses` translation |
| `output_config` rejected on `/v1/messages` | Claude Code request during manual implementation | Whitelist fields in native forwarder instead of spreading payload |
| `thinking.type: adaptive` rejected | Known from upstream report, verified during testing | Downgrade to `{ type: 'enabled', budget_tokens: max(1024, max_tokens-1) }` |
| Model ID `[1m]` not stripped | Claude models returning "model not supported" | Strip `[1m]` suffix, only append `-1m` when variant exists in catalog |

## Appendix C: Final Commit History

```
03b75b0 chore(tpatch): record 5 cosmetic features and update three-tier-routing patch
ac4fefd feat: implement 5 cosmetic features from tpatch stress test
6437629 docs(tpatch): case study and quality audit of 5-model stress test
61d7dd3 chore(tpatch): stress test results across 5 models and 3 routing tiers
77e011f fix: add /v1 route and strip temperature from /responses requests
a89230d chore(tpatch): record three-tier-routing feature with compatibility report
b56b9da feat: three-tier endpoint routing for full model compatibility
8a8627b feat: add request logging middleware with verbose mode
```

## Appendix D: Feature Tracking State

```
tpatch status (final):
  - hide-internal-models     [applied]  — Sonnet recipe → partial apply → manual fix → record
  - log-model-display-name   [applied]  — GPT-5.5 spec → manual implement → record
  - model-vendor-filter      [applied]  — Gemini analysis → full rewrite → record
  - startup-model-count      [applied]  — GPT-5.4 spec → 1-line manual change → record
  - health-endpoint          [applied]  — Haiku design → Hono port → record
  - three-tier-routing       [applied]  — Manual Path B → record → re-record after fixes
  - native-payload-sanitization [defined] — in progress (other thread)
  - three-tier-routing-tests    [defined] — in progress (other thread)
```
