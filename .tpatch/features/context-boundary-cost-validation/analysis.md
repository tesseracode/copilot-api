# Analysis

The proxy exposes upstream context limits but does not empirically verify or preflight them. Harness teams need evidence for prompt, output, and combined-window overflow behavior plus observable token and Copilot credit usage.

This feature adds a dry-run-by-default probe using one small-context model and direct/proxy blame isolation. It captures response usage and before/after account `credits_used` without inventing a token-to-AIC formula.

Risk is controlled by requiring `--execute`, limiting the default matrix to one model and four cases, using deterministic generated prompts, and clearly reporting account-level attribution caveats.
