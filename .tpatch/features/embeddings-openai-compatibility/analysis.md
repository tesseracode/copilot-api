# Analysis

Copilot embeddings accepts string arrays, batches, and dimensions but rejects the OpenAI-standard scalar string. The route performs no runtime validation, omits cancellation, returns incomplete top-level response fields, and forwards opaque text errors.

Normalize scalar input to a one-item array and enforce only verified options. Preserve model access regardless of pricing. Risk is limited to clearer boundary validation and standard response/error wrapping.
