# Gateway Live Acceptance — 2026-07-23

## Runtime

- Built Node proxy: `node dist/main.js start --port 4245 --account-type enterprise --verbose`
- `GET /health`: HTTP 200, version `0.7.0`, model_count `40`.
- `GET /v1/models`: HTTP 200, `40` models.
- No `Access-Control-Allow-Origin` header was emitted by health, pricing, Responses, or embeddings.

## Native Responses create + stream

```sh
curl -i http://localhost:4245/v1/responses \
  -H 'Content-Type: application/json' \
  --data '{"model":"gpt-5.6-sol","input":"Reply PONG","max_output_tokens":8,"reasoning":{"effort":"low"},"stream":false}'
# HTTP 400 structured provider error

curl -i http://localhost:4245/v1/responses \
  -H 'Content-Type: application/json' \
  --data '{"model":"gpt-5.6-sol","input":"Reply PONG","max_output_tokens":64,"reasoning":{"effort":"low"},"stream":false}'
# HTTP 200; usage, copilot_usage, output items, request IDs preserved

curl -N http://localhost:4245/v1/responses \
  -H 'Content-Type: application/json' \
  --data '{"model":"gpt-5.6-sol","input":"Reply PONG","max_output_tokens":64,"reasoning":{"effort":"low"},"stream":true}'
# HTTP 200; one response.completed event with usage and copilot_usage
```

`GET /v1/responses/resp_123` returned HTTP 404. Retrieve/cancel/background/conversation lifecycle remains unsupported and unadvertised.

## Embeddings

```sh
curl -i http://localhost:4245/v1/embeddings -H 'Content-Type: application/json' \
  --data '{"model":"text-embedding-3-small","input":"hello"}'
# HTTP 200; object=list; model=text-embedding-3-small; 1 x 1536 vector

curl -i http://localhost:4245/v1/embeddings -H 'Content-Type: application/json' \
  --data '{"model":"text-embedding-3-small","input":["hello"]}'
# HTTP 200; equivalent one-item result

curl -i http://localhost:4245/v1/embeddings -H 'Content-Type: application/json' \
  --data '{"model":"text-embedding-3-small","input":["hello","world"],"dimensions":64,"encoding_format":"float"}'
# HTTP 200; 2 x 64 vectors

curl -i http://localhost:4245/v1/embeddings -H 'Content-Type: application/json' \
  --data '{"model":"text-embedding-3-small","input":"hello","encoding_format":"base64"}'
# HTTP 400; stable invalid_request_error, code=invalid_value, param=encoding_format
```

Successful responses preserve `x-copilot-service-request-id` and `x-github-request-id` and normalize top-level OpenAI fields.

## Pricing freshness and conditional GET

- Built Node startup refresh completed without `Bun is not defined`.
- `GET /v1/pricing`: HTTP 200, `stale=false`, no source error.
- HTTP/body ETag: `"39cd191b606d903ada45076343d0ac4b52b5b4c408cfe3b94c3d22b46d114796"`.
- `If-None-Match: W/"39cd191b606d903ada45076343d0ac4b52b5b4c408cfe3b94c3d22b46d114796"` returned HTTP 304 with no body.
- Canonical docs rows: 28.
- Published accessible priced models: 21.
- Mapped but inaccessible rows: 0.
- Accessible models without pricing: 19; these remain present in `/v1/models` and usable.
- Intentional unmatched docs names: GPT-5.4 nano, Claude Sonnet 4, Claude Opus 4.5, Claude Opus 4.8 (fast mode) (preview), Claude Fable 5, Raptor mini, Kimi K2.7 Code.

The source ETag (`upstream_etag`) and public filtered representation ETag (`public_etag`) are separate fields.

## CORS and privacy

Wildcard CORS is disabled by default. `/token`, `/usage`, pricing, health, model, embeddings, and Responses routes do not emit browser CORS grants. The service remains private/internal; tesseragateway owns public authentication and TLS policy.
