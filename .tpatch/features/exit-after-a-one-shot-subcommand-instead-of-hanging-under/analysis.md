# Analysis

`bun run dev auth` finishes its work, prints `GitHub token written to ...`, and then hangs until the user presses Ctrl-C. A differential probe isolates the cause: `bun run start -- debug` exits with code 0 after 976ms, while `bun run dev debug` never exits, and both emit identical output. The command logic therefore completes correctly and Bun's `--watch` watcher, which the `dev` script enables, is what keeps the process alive.

This is not specific to `auth`. Of the four subcommands, three are one-shot — `auth`, `debug` and `check-usage` — and all three are affected; `check-usage` was confirmed alongside `debug`. Only `start` is long-running, and it received a partial fix in `c9e35aa`: a development-only SIGINT handler that closes the server and exits, which made one Ctrl-C sufficient for the server. That fix is installed next to `serve()` in `src/start.ts`, so it is unreachable from any other command, and it addresses interrupt handling rather than normal completion. A one-shot command has no server to close and simply returns, so nothing calls `process.exit`.

The obvious fix — exiting unconditionally after `runMain` resolves — is wrong and would be a serious regression. `runServer` returns as soon as `serve()` has been called rather than awaiting the server, so `await runMain(main)` resolves for `start` too. Exiting there would kill the development server the instant it began listening.

Distinguishing the two cases by name or by inspecting `process.argv` would reintroduce exactly the enumerated-list fragility this repository has already been burned by; a subcommand added later would be silently misclassified. Instead the distinction is declared: commands are one-shot by default and `runServer` marks itself long-running.

That polarity is deliberate. If a future server command forgets to declare itself, it exits immediately under `dev` and the mistake is obvious on the first run. If a future one-shot command were instead required to opt into exiting and forgot, it would hang silently — which is precisely the bug being fixed. The failure mode of forgetting should be loud, not silent.

The exit is not gated on `NODE_ENV`, because a one-shot command that has returned has nothing left to do in any environment; under the production script the process was already exiting on its own, so the call is a no-op there rather than a behavior change.

The bug is only observable across a process boundary — the hang belongs to the watcher, not to any function — so the regression test spawns the real command. It was confirmed to fail against the unfixed entrypoint by hanging until killed at 20 seconds, and to pass in roughly 730ms once fixed.
