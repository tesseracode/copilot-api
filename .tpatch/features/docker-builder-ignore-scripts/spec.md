# Specification

1. Builder dependency install uses `--frozen-lockfile --ignore-scripts`.
2. Runner behavior remains unchanged.
3. Clean native-platform and linux/amd64 builder images complete without executing `prepare`.
4. Full clean image builds successfully.
5. Built image starts and serves `/health` with no application runtime change.
6. Repository quality gates continue to pass.

Out of scope: replacing the existing multi-stage Dockerfile or changing package lifecycle scripts outside containers.
