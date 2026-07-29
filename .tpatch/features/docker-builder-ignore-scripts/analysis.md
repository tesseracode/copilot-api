# Analysis

The builder stage runs `bun install --frozen-lockfile`, which executes `prepare: simple-git-hooks` in an image containing neither `.git` nor the `git` binary. Clean native and amd64 builds completed locally but emitted repeated `git: not found` errors; another environment reported `skipInstall is not a function` from the same hook lifecycle.

The hook is irrelevant to compilation and environment-sensitive. The runner already uses `--ignore-scripts`. Applying the same flag to the builder removes the fragile lifecycle boundary without changing application/runtime behavior.
