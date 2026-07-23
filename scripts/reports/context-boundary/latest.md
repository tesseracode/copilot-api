# Context Boundary Report — 2026-07-20T20:14:39.004Z

- Model: `gpt-4`
- Endpoint: `/chat/completions`
- Executed: true
- Cost attribution: provider nano-AIU + account-delta-only
- Observed account credit delta: 0

| Case | Estimate | Output requested | Direct | Proxy | Direct AIU | Proxy AIU | Classification |
|---|---:|---:|---|---|---:|---:|---|
| control | 515 | 16 | 200 | 200 | 0.144250 | 0.144250 | accepted-by-upstream |
| prompt-over | 33280 | 16 | 200 | 200 | 8.309250 | 4.181250 | accepted-by-upstream |
| combined-over | 29182 | 4096 | 200 | 200 | 4.207250 | 3.789250 | accepted-by-upstream |
| output-over | 131 | 4608 | 200 | 200 | 0.333750 | 0.289750 | accepted-by-upstream |

## Caveats

- Local token counts are estimates; provider usage is authoritative when returned.
- Credit delta is account-level and may include concurrent activity or delayed accounting.
- Per-request AIU is derived from provider-returned nano-AIU; no AIU-to-AIC conversion was inferred.
