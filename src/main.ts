#!/usr/bin/env node

import { defineCommand, runMain } from "citty"

import { auth } from "./auth"
import { checkUsage } from "./check-usage"
import { debug } from "./debug"
import { isLongRunning } from "./lib/process-lifetime"
import { start } from "./start"

const main = defineCommand({
  meta: {
    name: "copilot-api",
    description:
      "A wrapper around GitHub Copilot API to make it OpenAI compatible, making it usable for other tools.",
  },
  subCommands: { auth, start, "check-usage": checkUsage, debug },
})

await runMain(main)

// Under `bun run dev` the watcher outlives a finished one-shot command, so the
// shell never returns. Servers hold the process themselves and opt out.
if (!isLongRunning()) {
  process.exit(0)
}
