# Analysis

The proxy forwards effort inconsistently and can send values unsupported by a selected model. Copilot now advertises per-model `capabilities.supports.reasoning_effort` sets spanning `none`, `minimal`, `low`, `medium`, `high`, `xhigh`, and `max`.

The feature is not present upstream. It extends `api-context-effort-migration` by resolving effort from the cached catalog before endpoint forwarding. Literal `auto` is a client/default sentinel and must never reach an upstream API.

Risk is localized to request normalization. Exact supported values remain unchanged; unsupported recognized values clamp to the nearest supported value at or below the request. No prompt inspection or model-family hardcoding is required.
