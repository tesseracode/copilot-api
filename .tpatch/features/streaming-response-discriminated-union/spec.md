# Specification

1. Both services return `{kind: object, body}` or `{kind: stream, stream}`.
2. Return types are explicit generic discriminated unions.
3. All four handler consumers dispatch only on `kind` and handle variants exhaustively.
4. Existing streaming, abort, terminal error, usage and translation behavior is unchanged.
5. `isNonStreaming` and runtime async-iterator discrimination are removed from production.
6. A misleading `choices` property cannot change stream dispatch.
7. Mutation tests prove wrong discriminants and missing variants fail tests/typecheck.
8. All quality gates pass.
