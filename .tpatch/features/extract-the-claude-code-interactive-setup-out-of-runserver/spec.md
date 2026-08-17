# Specification

1. The Claude Code interactive setup lives in its own named function that takes the server URL and performs the model prompts, env-script generation, and clipboard handling.
2. `runServer` calls that function only when `options.claudeCode` is set, at the same point in the startup sequence as today.
3. `runServer` passes `max-lines-per-function` with real headroom rather than sitting at the limit.
4. The shared lint configuration is not overridden, relaxed, or file-disabled anywhere.
5. Behavior with `--claude-code` is unchanged: the same two prompts in the same order, the same env-script keys and values, the same clipboard write, and the same fallback that logs the command when the clipboard is unavailable.
6. Behavior without `--claude-code` is unchanged, including that no prompt is issued.
7. 1M context detection is preserved exactly: the `ANTHROPIC_MODEL` env check still runs before the interactive selection, and a `-1m` model chosen interactively still ORs into `state.is1MContext` without clearing a value the env already set.
8. The `invariant` guarding that models are loaded is retained.
9. Everything after the block is unchanged, including the usage-viewer box, the `serve` call, and the development-only SIGINT handler.
10. Tests cover the extracted function directly with stubbed prompts and clipboard, asserting the generated env script, the 1M OR-ing behavior, and that a clipboard failure falls back to logging instead of throwing.
