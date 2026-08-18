# Analysis

`translateRequestToResponses` builds its result as a strict allowlist — `model`, `input`, `stream`, tools, `max_output_tokens` and `reasoning` — so `temperature` and `top_p` are never carried to the Responses API. The inline comment the backlog entry cites no longer exists; `create-responses.ts` contains no reference to either parameter, so nothing in the code records why they are absent.

The omission is still correct. A live probe against every Responses model tested returns `400 Unsupported parameter: 'temperature' is not supported with this model` for `temperature: 0.2`. Two measurements refine that picture. First, `temperature: 1` is **accepted**, so dropping the default value is a semantic no-op and warning about it would be pure noise. Second, `top_p` support is **model-dependent**: `gpt-5.3-codex` accepts `top_p: 0.5` while `gpt-5.4-mini`, `gpt-5.4`, `gpt-5.5` and `gpt-5.6-luna` reject it.

The user-visible problem is that the loss is silent and inconsistent. The same client request behaves differently depending only on which model is selected: Chat-routed models reach `createChatCompletions`, which forwards the whole payload with `JSON.stringify`, so `temperature` is honoured; Responses-routed models silently discard it. A user comparing two models sees sampling settings work for one and vanish for the other with no error, no warning and no documentation.

Two richer fixes were considered and rejected on evidence.

Forwarding the parameters and letting upstream reject them would make the loss loud, but it is a straightforward regression. Requests that succeed today — any client that sends a default `temperature: 0.7`, which many SDKs do unconditionally — would begin returning `400`. Trading silent degradation for broken requests is a bad exchange, and it would break the compatibility canaries this proxy exists to serve.

Forwarding selectively per model is more attractive because `gpt-5.3-codex` genuinely supports `top_p`, so the blanket drop discards a real capability. It is not implementable safely: the catalog advertises nothing about either parameter. A full scan of the live `/models` response contains no occurrence of the strings `temperature` or `top_p` anywhere, in `capabilities.supports`, `limits`, or any other field. Support could therefore only be encoded as a hardcoded per-model list, which is exactly the stale-heuristic pattern this project has already been burned by, and it would silently misreport the moment a model is added or upstream changes behavior.

That leaves the proportionate change: keep the current, correct behavior and stop it being invisible. A single warning per request naming the model and the dropped parameters gives operators an immediate answer to "why is my temperature ignored?", and README documentation reaches users who never see server logs. Suppressing the warning when the value is `1` keeps it meaningful, because that case is measurably equivalent to sending nothing.

Risk is minimal: no request or response bytes change, the warning sits in the single funnel through which every Responses translation already passes, and `translateRequestToResponses` is a pure function that tests can drive directly.
