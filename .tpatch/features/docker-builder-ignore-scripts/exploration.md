# Exploration

- `Dockerfile:5`: builder install currently executes lifecycle scripts.
- `Dockerfile:14`: runner already uses `--ignore-scripts`, establishing the intended container pattern.
- `package.json`: `prepare` invokes `simple-git-hooks`.
- `.dockerignore`: excludes `.git`, so hook installation cannot succeed meaningfully.
- Clean native and amd64 probes showed the prepare hook running with repeated missing-git errors; the reported team environment failed inside the same hook.
- Smallest change is one Dockerfile flag plus clean build/smoke evidence.
