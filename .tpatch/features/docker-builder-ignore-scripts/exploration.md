# Exploration

- `Dockerfile:5`: builder install currently executes lifecycle scripts.
- `Dockerfile:14`: runner already uses `--ignore-scripts`, establishing the intended container pattern.
- `package.json`: `prepare` invokes `simple-git-hooks`.
- `.dockerignore`: excludes `.git`, so hook installation cannot succeed meaningfully.
- Clean native and amd64 probes showed the prepare hook running with repeated missing-git errors; the reported team environment failed inside the same hook.
- `node_modules/.bin/tsdown` is a relative symlink to `../tsdown/dist/run.mjs`. A second team environment showed Bun 1.2.19 resolving imports relative to the symlink path; direct invocation of the target module succeeded.
- Local pinned-image comparison showed all three launchers succeed, proving the bug is environment-sensitive. Direct `run.mjs` still removes the extra package-script/symlink resolution layers.
- The smallest aggregate fix remains two Dockerfile command flags/paths plus clean native, amd64, full-image, and CLI-smoke evidence.
