# Analysis

Translated streams currently rethrow non-abort failures after headers are sent, so clients receive partial HTTP 200 SSE followed by clean EOF. A pre-implementation regression assertion failed because no terminal error event was present.

`streamSSEWithAbort` already owns abort classification and is the smallest shared seam. Format-specific callers should supply terminal error writers; client aborts remain silent. Native Responses needs a byte-preserving ReadableStream wrapper because it bypasses the SSE helper.
