# Exploration

- `package.json`: `dev` is `bun run --watch ./src/main.ts` while `start` sets `NODE_ENV=production` without `--watch`; the watcher is the entire difference between the hanging and exiting cases.
- `src/main.ts`: `await runMain(main)` is the single point every subcommand returns through, and therefore the only place a general fix belongs.
- `src/lib/process-lifetime.ts`: new module holding the one-shot/long-running declaration, kept separate so neither `main.ts` nor `start.ts` has to import the other.
- `src/start.ts`: `runServer` returns right after `serve()` rather than awaiting the server, which is why an unconditional exit in `main.ts` would kill `dev start`; it now calls `markLongRunning()` beside the `serve()` call.
- `src/start.ts` SIGINT handler from `c9e35aa`: the earlier partial fix, scoped to the server path and to interrupts rather than normal completion.
- `src/auth.ts`, `src/debug.ts`, `src/check-usage.ts`: the three one-shot runners, unmodified — they inherit the behavior rather than each calling exit.
- `tests/process-lifetime.test.ts`: unit coverage for the declaration plus a subprocess test that runs `bun run dev debug`, chosen over `auth` because it needs no device-flow interaction.
- Measured evidence (2026-09-07): `bun run start -- debug` exits code 0 in 976ms; `bun run dev debug` hung until killed at 15s with identical output; after the fix it exits in 670ms, `dev check-usage` in 1203ms, and `dev start` stayed alive 12s, answered `/health`, exited on one SIGINT in 4ms and released its port.
- Out of scope: changing what any command prints, altering the SIGINT handler, and gating the exit on `NODE_ENV`.
