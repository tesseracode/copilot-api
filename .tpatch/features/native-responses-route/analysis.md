# Analysis

The proxy advertises upstream Responses support but exposes no downstream Responses endpoint. Existing `createResponses` is a lossy Chat compatibility adapter and cannot serve as a native contract.

This feature adds private create/stream passthrough aliases for eligible catalog models with minimal validation, raw JSON/SSE preservation, abort propagation, and resilient IDE-token recovery.
