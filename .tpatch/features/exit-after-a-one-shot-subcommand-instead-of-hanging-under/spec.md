# Specification

1. `bun run dev auth` exits on its own once the token is written, with no second Ctrl-C.
2. `bun run dev debug` and `bun run dev check-usage` likewise exit on their own.
3. A one-shot subcommand exits with code 0 when its work succeeded.
4. `bun run dev start` keeps running and continues serving after startup; it must not exit when `runMain` resolves.
5. `bun run dev start` still exits fully on a single SIGINT and releases its port, preserving the behavior added in `c9e35aa`.
6. Production invocations are unchanged, since a returning one-shot command was already exiting there.
7. Commands are one-shot by default; only a long-running command declares itself, so a subcommand added later inherits the correct behavior without being enumerated anywhere.
8. The classification is explicit rather than inferred from the command name or `process.argv`.
9. Command output is unaffected: the same lines are printed as before.
10. A regression test spawns a real one-shot command under the watch script and asserts it exits without a signal, because the hang is only observable across a process boundary.
