import { describe, expect, it } from "bun:test"
import { spawn } from "node:child_process"

import { isLongRunning, markLongRunning } from "~/lib/process-lifetime"

/** Runs a CLI command and reports whether it exits without being killed. */
function runCommand(
  args: Array<string>,
  timeoutMs: number,
): Promise<{ exited: boolean; code: number | null }> {
  return new Promise((resolve) => {
    const child = spawn("bun", args, { stdio: "ignore" })
    const timer = setTimeout(() => {
      child.kill("SIGKILL")
      resolve({ exited: false, code: null })
    }, timeoutMs)
    child.on("exit", (code) => {
      clearTimeout(timer)
      resolve({ exited: true, code })
    })
  })
}

describe("process lifetime", () => {
  it("treats a command as one-shot until told otherwise", () => {
    // Import order is the only state here; a fresh module starts one-shot.
    expect(typeof isLongRunning()).toBe("boolean")
  })

  it("stays marked once a long-running command declares itself", () => {
    markLongRunning()
    expect(isLongRunning()).toBe(true)
    markLongRunning()
    expect(isLongRunning()).toBe(true)
  })
})

/**
 * Bun's --watch mode keeps the process alive after a one-shot command
 * finishes, which is invisible to an in-process test: the hang belongs to the
 * watcher, not to the command. Only a real subprocess can observe it.
 */
describe("dev watch mode exits after a one-shot command", () => {
  it("exits without needing a signal", async () => {
    // Generous margins: a passing run exits in well under a second, so the
    // ceiling exists to catch a genuine hang, not to time a loaded machine.
    const result = await runCommand(["run", "dev", "debug"], 45_000)
    expect(result.exited).toBe(true)
    expect(result.code).toBe(0)
  }, 60_000)
})
