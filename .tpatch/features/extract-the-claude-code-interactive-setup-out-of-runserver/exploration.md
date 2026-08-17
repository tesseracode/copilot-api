# Exploration

- `src/start.ts` (`runServer`): 99 code lines across seven responsibilities; the `if (options.claudeCode)` block spans 51 of them and is the extraction target.
- `src/start.ts` imports `clipboard` and `invariant` solely for that block, so both move with it and stay in the same module.
- `src/lib/shell.ts` (`generateEnvScript`): builds the exported command from the env map and a shell flavour, already a pure helper needing no change.
- `src/lib/state.ts`: `state.is1MContext` is module-scoped, so the extracted function can keep setting it without new plumbing; only `serverUrl` needs to become a parameter.
- `eslint.config.js`: currently only sets `ignores` and forwards a prettier plugin, so relaxing the rule would mean introducing a new local override — explicitly out of scope.
- Rule configuration (`eslint --print-config`): `max-lines-per-function` is `max: 100, skipBlankLines: true, skipComments: true`; neighbouring limits are `max-lines` 800 and `complexity` 16.
- `tests/` has no existing start-up coverage, so the extracted function needs a new focused test file using `mock` over `consola.prompt` and the clipboard module.
- Ordering constraint to preserve: the `ANTHROPIC_MODEL` env detection must keep running before the interactive selection so the two sources OR together rather than overwrite.
- Out of scope: changing the startup sequence, extracting the other six responsibilities, altering prompt wording or env keys, and any lint-rule override.
