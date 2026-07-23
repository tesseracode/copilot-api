# Copilot SDK Harness Compatibility Brief

## Executive summary

Treat the Copilot model catalog as the source of truth for model IDs, endpoint routing, context planning, and supported effort values. Keep context compaction in the harness. Preserve provider usage metadata separately from OpenAI/Anthropic-compatible usage because Copilot returns exact per-request nano-AIU pricing data that compatibility translations may otherwise drop.

## Model catalog and user controls

Expose these catalog values to users:

- `capabilities.limits.max_context_window_tokens`: total advertised context.
- `capabilities.limits.max_prompt_tokens`: advertised prompt/input planning limit.
- `capabilities.limits.max_output_tokens`: advertised output ceiling.
- `capabilities.supports.reasoning_effort`: model-specific effort choices.
- `supported_endpoints`: routing source of truth.
- `preview` and `model_picker_enabled`: picker visibility/status.

A context selector such as 400K vs 1.1M is a harness policy over the same model when the catalog has one model ID. It controls when the harness compacts; it does not necessarily select a different upstream model. Preserve enough output reserve when computing the harness's effective prompt budget.

## Context behavior measured through Copilot

The boundary probe is `scripts/context-boundary-validation.ts`; it is dry-run by default and requires `--execute`.

A direct/proxy GPT-4 matrix used the catalog values 32,768 total context, 32,768 max prompt, and 4,096 max output. Copilot accepted all four requests in both paths, including:

- provider-reported 33,173 prompt tokens, above the advertised 32,768 prompt limit;
- a prompt plus requested max output above the advertised total;
- requested output above the advertised output limit.

The accepted requests generated short output, so actual prompt plus generated output remained within service tolerance. Conclusion: catalog limits are essential planning values but are not always strict request-time validators. Do not rely on upstream to reject a large requested output reservation, and do not infer that acceptance means the full requested output is available.

Recommended harness policy:

1. Compact before the advertised prompt budget.
2. Reserve expected output and tool-result growth.
3. On a context-length 4xx, compact and retry once.
4. Never silently truncate tool-call/result pairs or system instructions.
5. Keep local token counts advisory; provider usage is authoritative.

## Endpoint routing

Use this order:

1. Claude with `/v1/messages` support → native `/v1/messages`.
2. Models advertising `/responses` → `/responses`.
3. Remaining models → `/chat/completions`.

Important caveats:

- GPT-5.x and newer reasoning models may require `/responses`; forcing chat completions can lose support or fail.
- Claude routed through OpenAI chat can lose native thinking/tool semantics unless translated and rerouted to `/v1/messages`.
- Replayed Responses tool history requires non-empty correlation IDs; omit an optional Responses item `id` rather than sending `id: ""`.
- Preserve reasoning items distinctly from function calls; otherwise reasoning output can become ghost tool calls.
- For streaming tools, preserve stable call IDs and indices across argument deltas.

## Context signals

For Claude-compatible clients, `[1m]` in a configured model name and `anthropic-beta: context-1m-2025-08-07` can signal the harness/proxy to use its larger context policy. Strip client-only suffixes before upstream model lookup. Current large-context models may already expose one canonical catalog ID rather than separate `-1m` variants.

## Effort controls

`auto` is a harness setting, not a wire-level effort value. Resolve it to the route/model default or omit effort; never send literal `auto` upstream.

Supported values differ by model. Current observed sets include:

- Claude 4.6: `low`, `medium`, `high`, `max`.
- Newer Claude: may add `xhigh`.
- GPT-5.4/5.5: `none`, `low`, `medium`, `high`, `xhigh`.
- GPT-5.6: adds `max`.
- Gemini models may use `minimal`, `low`, `medium`, `high`.

Use `capabilities.supports.reasoning_effort`. Preserve exact matches. For unsupported recognized requests, fall down to the strongest supported value not above the request (`max → xhigh → high`). If the request is below the model floor, use the weakest advertised value. Do not infer effort from prompt text: effort is a reasoning allocation control, and models consume it differently by task.

Wire mappings:

- Anthropic Messages: `output_config.effort`.
- OpenAI Chat compatibility: `reasoning_effort`.
- OpenAI Responses: `reasoning: { effort }`.

## Usage, AIU, and credits

Standard response usage provides input/output/cached/reasoning token counts. Copilot additionally returns:

```json
{
  "copilot_usage": {
    "token_details": [
      {
        "token_type": "input",
        "token_count": 9,
        "batch_size": 1000000,
        "cost_per_batch": 500000000000
      }
    ],
    "total_nano_aiu": 22500000
  }
}
```

The provider total is reproducible as:

```text
sum(token_count × cost_per_batch ÷ batch_size) = total_nano_aiu
AIU = total_nano_aiu ÷ 1,000,000,000
```

Prompt caching changes cost because cache-read tokens have a different rate. Preserve `copilot_usage` even when translating the standard `usage` object. Do not claim AIU equals the CLI's displayed AIC without provider documentation for that naming/conversion.

`GET /copilot_internal/user` (exposed here as `/usage`) provides account-level `premium_interactions.credits_used` and `token_based_billing`. Before/after deltas can be delayed and can include concurrent consumers, so they are not reliable per-request attribution. Prefer response-level `total_nano_aiu` for request cost evidence.

## Authentication lifetime

The stored GitHub OAuth/device credential is long-lived, but each Copilot IDE token currently lasts about 30 minutes and advertises refresh after 25 minutes. Harnesses/proxies must refresh continuously, retain the last valid token on transient refresh failure, retry with bounded backoff before expiry, and retry a model request once after a 401 by obtaining a fresh IDE token.

The token also advertises the account-specific API endpoint (for example enterprise routing). Prefer that claim over requiring users to manually select account routing.

## Recommended compatibility checklist

- Refresh `/models` and do not hardcode new-model capabilities.
- Route by `supported_endpoints`.
- Expose context mode and effort independently.
- Treat context limits as planning budgets and compact in the harness.
- Use catalog-aware effort values; never send `auto`.
- Preserve tool IDs, reasoning blocks, streaming identities, standard usage, and `copilot_usage`.
- Record request IDs and direct-vs-proxy results for blame isolation.
- Refresh the 30-minute IDE token proactively and recover from one failed refresh/401.

## Local validation artifacts

- Context/cost script: `scripts/context-boundary-validation.ts`
- Latest context report: `scripts/reports/context-boundary/latest.md`
- Full JSON evidence: `scripts/reports/context-boundary/latest.json`
- Full model suite: `scripts/proxy-model-validation.ts`
