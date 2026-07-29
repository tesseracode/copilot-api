# Specification

1. Builder dependency install uses `--frozen-lockfile --ignore-scripts`.
2. Runner behavior remains unchanged.
3. Builder compilation invokes the locked tsdown entry module directly with `bun ./node_modules/tsdown/dist/run.mjs`, bypassing `.bin` symlink resolution.
4. Clean native-platform and linux/amd64 builder images complete without executing `prepare`.
5. Full clean image builds successfully.
6. Built image CLI starts successfully with no application runtime change.
7. Repository quality gates continue to pass.

Out of scope: replacing the existing multi-stage Dockerfile, changing package lifecycle scripts outside containers, or changing the local `bun run build` developer command.
