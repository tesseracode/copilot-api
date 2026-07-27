# Analysis

Architecture-review candidate 6 proposed "one error shape at the route seam", on the observation
that three routes forward through `forwardError` while three shape their own. Measuring what
clients actually receive inverted it.

The two upstream contracts genuinely differ. Verified live against `api.githubcopilot.com`:

| endpoint | upstream error body |
|---|---|
| `/v1/messages` | `{"type":"error","error":{"type":"invalid_request_error","message":"…"},"request_id":"…"}` |
| `/chat/completions` | `{"error":{"message":"…","code":"invalid_request_body"}}` |

Unifying them would have broken the Anthropic contract to match the OpenAI one. The embeddings
route's `type`/`code`/`message`/`param` body is the OpenAI error contract, not drift.

The real defect is narrower and worse: `/v1/messages` returns **two different shapes depending
on where the error originated**. Verified against the running proxy:

- upstream rejection → correct Anthropic envelope, because `forwardError` passes a recognised
  upstream envelope through untouched;
- local `badRequest` → `{"error":{"type":"invalid_request_error","message":"…"}}`, no top-level
  `type`;
- local throw → `{"error":{"message":"…","type":"error"}}`, no top-level `type`, and `type`
  nested in the wrong place.

So the endpoint is correct exactly when it is a pass-through and malformed exactly when the
proxy speaks for itself. It also contradicts the proxy's own streaming path on the same route:
`translateErrorToAnthropicErrorEvent` emits `{ type: "error", error: { type, message } }`, and
`AnthropicErrorEvent` declares that shape.

`badRequest` cannot carry the fix. The `requireToolCallId` call in `create-responses.ts` is
reachable from both `/v1/messages` and `/chat/completions`; only the `tool_result` call in
`non-stream-translation.ts` is Anthropic-only. Shaping therefore belongs at the route seam,
which is where the contract being served is known — the candidate's framing was right even
though its conclusion was backwards.

Deriving the Anthropic error type from HTTP status is not gold-plating. `forwardError` already
handles an upstream body that fails to parse as JSON by wrapping the raw text, which yields no
usable type at all; a plain-text 401 becomes indistinguishable from a rate limit. Local errors
alone would only ever produce `invalid_request_error` and `api_error`, so the mapping earns its
place specifically on that path.
