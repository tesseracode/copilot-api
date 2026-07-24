# Specification

1. Accept scalar and array string inputs equivalently.
2. Validate model, non-empty inputs, batch limits, dimensions, and float/default encoding.
3. Reject base64 and malformed values with stable OpenAI JSON errors.
4. Propagate request cancellation and timeout signals upstream.
5. Populate `object: list` and `model` on successful responses.
6. Preserve safe provider request IDs and status on errors.
7. String, array, batch, dimensions, errors, and cancellation tests pass.
