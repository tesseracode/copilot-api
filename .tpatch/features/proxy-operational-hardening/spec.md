# Specification

1. `/health` always reports the package/build version.
2. No route emits wildcard CORS by default.
3. `/token`, `/usage`, and private account surfaces never receive CORS headers.
4. Responses POST create+stream remains supported with existing usage/request-ID behavior.
5. Responses retrieve/cancel/background/conversation lifecycle remains 404/405 and unadvertised.
6. Health, CORS, and lifecycle regression tests pass.
