# Analysis

Chat and Responses services return an inferred object-or-async-iterable union. Four handlers distinguish it through `Symbol.asyncIterator`. The predicate is currently correct, so this is a contract/type-safety change rather than a user-facing bug.

A pre-implementation four-case service test failed for both object and stream branches because neither service returned the requested `kind` wrapper. Native Responses passthrough is separate and unaffected.
