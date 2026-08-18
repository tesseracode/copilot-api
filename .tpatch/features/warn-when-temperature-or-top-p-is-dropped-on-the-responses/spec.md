# Specification

## Warning behavior

1. A Responses-routed request carrying `temperature` other than `1` logs one warning naming the model and the dropped parameter.
2. A Responses-routed request carrying `top_p` other than `1` logs one warning naming the model and the dropped parameter.
3. When both are dropped, a single warning names both rather than logging twice.
4. `temperature: 1` and `top_p: 1` produce no warning, because upstream accepts those values and dropping them is measurably a no-op.
5. `null` and `undefined` values produce no warning.
6. A request carrying neither parameter produces no warning.
7. At most one warning is emitted per request, including for streaming requests.

## Behavior preservation

8. The translated Responses payload is unchanged: `temperature` and `top_p` are still never forwarded, and no other field is added or removed.
9. No request or response bytes change on any path, so existing clients see identical results.
10. Chat-routed models continue to forward `temperature` and `top_p` verbatim.
11. The native `/v1/responses` passthrough route is untouched and still forwards whatever the client sent.

## Documentation

12. `README.md` states that `temperature` and `top_p` are dropped for Responses-routed models because upstream rejects them, and that the request otherwise succeeds.
13. `README.md` documents the asymmetry: the same parameters are honoured on Chat-routed models, so behavior depends on the selected model.
14. `README.md` records that `top_p` support is model-dependent upstream and that the catalog advertises no capability for either parameter, which is why the proxy cannot forward them selectively.

## Coverage

15. Tests drive `translateRequestToResponses` directly and assert the warning fires for non-default values, names the model and the parameters, and stays silent for `1`, `null`, `undefined` and absence.
16. Tests assert the translated payload never contains `temperature` or `top_p` regardless of input.
