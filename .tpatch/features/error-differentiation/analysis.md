# Analysis

The original feature premise is stale: streaming disconnects, transport failures, token refresh and Anthropic status mapping are already differentiated by later features.

A fresh 22-case probe found a narrower non-stream defect. Local exception messages and unrecognized upstream bodies leak to clients/logs, arbitrary thrown values can omit messages, and safe request-ID/rate-limit headers are dropped. Recognized structured OpenAI and Anthropic envelopes already preserve status and should remain unchanged.
