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
- **Recipe**: 9 operations. **Would apply cleanly.** Created `filter-models.ts` with proper generics, added state field, registered CLI flag, wired into route handler, even wrote tests. Import paths use the project's `~/` alias convention correctly.
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

## Part 3: Is tpatch a good methodology?

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
   
   These are integration issues we wouldn't have found with unit tests alone.

3. **Compatibility reports as artifacts.** The 24-model compatibility matrix lives alongside the feature as a tpatch artifact. When upstream changes, the reconciliation process can re-run these tests.

4. **Feature isolation.** Each feature gets its own directory with analysis, spec, exploration, recipe, and patches. This is much better than a monolithic CHANGELOG.

### What didn't work well

1. **LLM quality variance is extreme.** Claude Sonnet 4.6 produced a production-ready recipe. Gemini fabricated an entire codebase. Same tool, same prompts, wildly different results. tpatch's value proposition depends heavily on which model drives it.

2. **The implement phase is fragile.** `replace-in-file` with literal string matching means the LLM must reproduce exact code from the file — including whitespace. 3 out of 5 models failed to do this reliably. The recipe format is deterministic but the LLM generation isn't.

3. **Path A (LLM-driven) requires a strong model.** Only Claude Sonnet 4.6 produced an actually-applicable recipe. For smaller/weaker models, Path B (human implements, tpatch records) is the only viable path.

4. **Config is single-model.** Running parallel stress tests was impossible because `config.yaml` only holds one model. We had to run sequentially, which took ~7 minutes instead of ~2.

### Is it worth the hassle?

**For active forks: yes.** If you're maintaining a fork with 3+ custom features and upstream updates regularly, the reconciliation value alone justifies tpatch. Without it, you're doing `git rebase` and hoping. With it, you have structured patches with intent metadata that can be re-evaluated.

**For one-off patches: maybe not.** If you're making a single change to a fork you'll never update, tpatch's ceremony (6 phases, multiple artifacts) is overkill. Just make the change and commit.

**For LLM-driven development: it depends on the model.** The structured phases (analyze → define → explore → implement) are genuinely useful as a thinking framework. But the implement phase only works with top-tier models that can faithfully reproduce file contents. For weaker models, use Path B exclusively.

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

## Appendix: Routing Tier Validation

The stress test validated all 3 routing tiers under real LLM workloads:

| Tier | Endpoint | Models Tested | Multi-turn Conversations | Result |
|------|----------|--------------|------------------------|--------|
| Native Anthropic | `/v1/messages` | claude-sonnet-4.6, claude-haiku-4.5 | 4 phases × 2 models = 8 calls | All passed |
| Responses API | `/responses` | gpt-5.5, gpt-5.4 | 4 phases × 2 models = 8 calls | 7 passed, 1 timeout |
| Chat Completions | `/chat/completions` | gemini-2.5-pro | 4 phases × 1 model = 4 calls | All passed |

Total: **20 LLM API calls** across 3 routing tiers, **19 successful**, **1 timeout** (model performance, not proxy failure).
