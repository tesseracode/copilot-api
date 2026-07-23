# Analysis

GPT Responses rejects empty identifiers in replayed tool history. The proxy previously converted a missing OpenAI assistant tool-call ID or tool-result `tool_call_id` into an invalid upstream `call_id`, producing a remote 400 with an opaque `input[n]` path.

Current valid replay translation correctly omits the optional Responses item `id` and correlates `function_call` with `function_call_output` through non-empty `call_id`. A live GPT-5.6-sol replay confirms this payload is accepted.

The compatible change is to validate both correlation-ID boundaries before the upstream fetch. Risk is low: valid payloads are unchanged, while malformed requests fail earlier with a local 400. A stale proxy process must be restarted before end-to-end probes exercise the new guards.
