# Analysis

Raw Copilot responses include `copilot_usage` with cache token classes and exact nano-AIU cost. Direct Chat preserves it, but Responses-to-Chat and Chat-to-Anthropic translations drop it.

The compatible change keeps standard `usage` unchanged and adds a top-level extension with raw details plus reproducible AI-credit/cache summaries. Streaming preservation is limited to terminal metadata actually supplied upstream.
