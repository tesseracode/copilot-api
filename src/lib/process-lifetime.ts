/**
 * Bun's `--watch` mode (used by the `dev` script) keeps the process alive
 * after a command's work is done, so a one-shot subcommand such as `auth`,
 * `debug` or `check-usage` appears to hang and needs a second Ctrl-C.
 *
 * Commands are treated as one-shot by default and the process exits once they
 * return. A long-running command must say so, which is the safer polarity: a
 * server that forgets to declare itself exits immediately and is noticed at
 * once, whereas a one-shot command that forgets to exit hangs silently.
 */
let longRunning = false

export function markLongRunning(): void {
  longRunning = true
}

export function isLongRunning(): boolean {
  return longRunning
}
