# Analysis

Copilot `/models` does not currently return token prices, while GitHub publishes canonical machine-readable pricing YAML in the public docs repository. The proxy also drops the real upstream `model_picker_category` field.

This feature adds a one-shot ETag-aware updater, atomic stale-on-error cache, safe `/pricing` endpoints, and namespaced model summaries. Pricing availability must never block startup or model requests.

Risk centers on upstream YAML changes and display-name aliases; parsing is validated and unmatched rows are reported rather than guessed.
