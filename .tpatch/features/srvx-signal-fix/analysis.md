# Analysis: srvx Node.js Signal Abort Fix

## Summary

The built `copilot-api` binary (`node dist/main.js`) was aborting every upstream fetch within 3-270ms with `"This operation was aborted"`. The same code running under Bun (`bun run ./src/main.ts`) worked perfectly. Root cause: srvx 0.8.x's Node adapter.

## Investigation

### Symptoms
- All models affected: Claude, GPT-5.x, Gemini — every request aborts
- Only happens with `node dist/main.js` (the built binary), not `bun run ./src/main.ts`
- Abort times: 3.2ms, 5.9ms, 54ms, 68ms, 179ms, 231ms, 267ms — too fast for network
- Token was fresh (server just started)
- Routing was correct (logs show `/responses` for GPT-5.x, `/chat/completions` for Claude)

### Red herrings we ruled out
1. **Stale copilot token** — No: fresh proxy, token just fetched
2. **Model routing** — No: `resolveEndpoint` returned correct endpoints
3. **Go client timeout** — No: Go's `http.Client{Timeout: 60s}`, context 5 minutes
4. **Endpoint mismatch** — No: `/v1/chat/completions` = same handler as `/chat/completions`

### Root cause: srvx 0.8.x Node adapter signal handling

```javascript
// srvx 0.8.x — BROKEN on Node.js
get signal() {
    if (!this.#abortSignal) {
        this.#abortSignal = new AbortController();
        this._node.req.once("close", () => {
            this.#abortSignal?.abort();  // fires on ANY close
        });
    }
    return this.#abortSignal.signal;
}
```

Node's HTTP/1.1 `close` event fires when the request body is fully consumed, which can happen before the upstream response arrives. The signal aborts → our `fetch(url, { signal })` throws `AbortError` → 500.

```javascript
// srvx 0.11.x — FIXED
// Only aborts when response wasn't finished or request errored
if (res) res.once("close", () => {
    if (req.errored) abort(req.errored);
    else if (!res.writableEnded) abort();
});
else req.once("close", () => {
    if (!req.complete) abort();
});
```

### Why Bun wasn't affected
Bun handles the Hono request natively without the srvx Node adapter shim. Its signal implementation doesn't have the premature-close problem.

## Fix

`bun add srvx@latest` — upgraded from 0.8.9 to 0.11.15.

## Test Results

| Runtime | srvx | gpt-5.5 | claude-opus-4.7 | claude-sonnet-4.6 |
|---------|------|:---:|:---:|:---:|
| node + srvx 0.8.9 | ❌ abort 3ms | ❌ abort 270ms | ❌ abort 5ms |
| node + srvx 0.8.16 | ❌ abort 360ms | ❌ | ❌ |
| node + srvx 0.11.15 | ✅ 200 | ✅ 200 | ✅ 200 |
| bun (no srvx shim) | ✅ 200 | ✅ 200 | ✅ 200 |
