# Analysis

The builder stage runs `bun install --frozen-lockfile`, which executes `prepare: simple-git-hooks` in an image containing neither `.git` nor the `git` binary. Clean native and amd64 builds completed locally but emitted repeated `git: not found` errors; another environment reported `skipInstall is not a function` from the same hook lifecycle.

The hook is irrelevant to compilation and environment-sensitive. The runner already uses `--ignore-scripts`. Applying the same flag to the builder removes the fragile lifecycle boundary without changing application/runtime behavior.

A second environment then exposed another Bun 1.2.19 builder portability issue: `bun run build` and `bunx --bun tsdown` resolved the `.bin/tsdown` symlink incorrectly, while `bun ./node_modules/tsdown/dist/run.mjs` succeeded. All three paths succeeded in local native/amd64 probes, confirming the failure is environment-sensitive rather than a bad tsdown package. The direct entry module is the robust container invocation because it bypasses package-script and `.bin` symlink resolution while executing the same locked tsdown 0.15.6 code.

The feature now represents one auditable intent: make the pinned Docker builder independent of development lifecycle hooks and Bun's environment-sensitive launcher resolution.
