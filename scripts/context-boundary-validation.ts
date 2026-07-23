#!/usr/bin/env bun

import { mkdir, readFile, writeFile } from "node:fs/promises"
import { homedir } from "node:os"
import { join } from "node:path"

import type { Model, ModelsResponse } from "~/services/copilot/get-models"

import { copilotHeaders } from "~/lib/api-config"
import { resolveEndpoint } from "~/lib/endpoint-routing"
import { state } from "~/lib/state"
import { getTokenCount } from "~/lib/tokenizer"
import { getCopilotToken } from "~/services/github/get-copilot-token"

import {
  buildChatPayload,
  buildProbeCases,
  calibratePrompt,
  classifyPair,
  creditDelta,
  extractCopilotUsage,
  extractUsage,
  nanoAiuToAiu,
  type ProbeCase,
  type ProbeResult,
} from "./lib/context-boundary"

const args = process.argv.slice(2)
const execute = args.includes("--execute")
const modelArg = args.find((arg) => arg.startsWith("--model="))?.slice(8)
const via = args.find((arg) => arg.startsWith("--via="))?.slice(6) ?? "both"
const margin = Number(
  args.find((arg) => arg.startsWith("--margin="))?.slice(9) ?? 512,
)
const timeoutMs = Number(
  args.find((arg) => arg.startsWith("--timeout="))?.slice(10) ?? 120_000,
)
const proxyUrl = (
  args.find((arg) => arg.startsWith("--proxy-url="))?.slice(12)
  ?? "http://localhost:4141"
).replace(/\/$/, "")
let directBaseUrl = "https://api.githubcopilot.com"
const selectedCases = new Set(
  (
    args.find((arg) => arg.startsWith("--cases="))?.slice(8)
    ?? "control,prompt-over,combined-over,output-over"
  ).split(","),
)

if (!new Set(["direct", "proxy", "both"]).has(via)) {
  throw new Error("--via must be direct, proxy, or both")
}
if (!Number.isFinite(margin) || margin < 1)
  throw new Error("--margin must be positive")
if (!Number.isFinite(timeoutMs) || timeoutMs < 1)
  throw new Error("--timeout must be positive")

async function fetchJson(
  url: string,
  init?: RequestInit,
): Promise<{ response: Response; body: unknown; text: string }> {
  const response = await fetch(url, {
    ...init,
    signal: AbortSignal.timeout(timeoutMs),
  })
  const text = await response.text()
  let body: unknown
  try {
    body = JSON.parse(text)
  } catch {
    body = undefined
  }
  return { response, body, text }
}

function hasCompleteLimits(model: Model): boolean {
  const unsafeModel = model as { capabilities?: Model["capabilities"] }
  const limits = unsafeModel.capabilities?.limits
  return Boolean(
    limits?.max_context_window_tokens
      && limits.max_prompt_tokens
      && limits.max_output_tokens,
  )
}

function chooseModel(models: ModelsResponse): Model {
  const eligible = models.data
    .filter((model) => hasCompleteLimits(model))
    .sort(
      (a, b) =>
        (a.capabilities.limits.max_context_window_tokens ?? Infinity)
        - (b.capabilities.limits.max_context_window_tokens ?? Infinity),
    )
  const model =
    modelArg ?
      eligible.find((item) => item.id === modelArg)
    : eligible.find((item) => item.model_picker_enabled)
  if (!model)
    throw new Error(`No eligible model found${modelArg ? `: ${modelArg}` : ""}`)
  return model
}

function directBody(
  model: Model,
  content: string,
  outputTokens: number,
): { url: string; body: unknown } {
  const endpoint = resolveEndpoint(model.id, { object: "list", data: [model] })
  if (endpoint === "/responses") {
    return {
      url: `${directBaseUrl}/responses`,
      body: {
        model: model.id,
        input: [{ type: "message", role: "user", content }],
        max_output_tokens: outputTokens,
        reasoning: { effort: "low" },
        stream: false,
      },
    }
  }
  if (endpoint === "/v1/messages") {
    return {
      url: `${directBaseUrl}/v1/messages`,
      body: {
        model: model.id,
        messages: [{ role: "user", content }],
        max_tokens: outputTokens,
        stream: false,
      },
    }
  }
  return {
    url: `${directBaseUrl}/chat/completions`,
    body: buildChatPayload(model.id, content, outputTokens),
  }
}

function proxyBody(
  model: Model,
  content: string,
  outputTokens: number,
): { url: string; body: unknown } {
  return {
    url: `${proxyUrl}/v1/chat/completions`,
    body: buildChatPayload(model.id, content, outputTokens),
  }
}

function safeHeaders(response: Response): Record<string, string> {
  const names = [
    "x-copilot-service-request-id",
    "x-github-request-id",
    "x-ratelimit-limit",
    "x-ratelimit-remaining",
    "retry-after",
  ]
  return Object.fromEntries(
    names.flatMap((name) => {
      const value = response.headers.get(name)
      return value ? [[name, value]] : []
    }),
  )
}

async function runRequest(
  probeCase: ProbeCase,
  dimension: "direct" | "proxy",
  target: { url: string; body: unknown },
): Promise<ProbeResult> {
  const started = Date.now()
  try {
    const { response, body, text } = await fetchJson(target.url, {
      method: "POST",
      headers:
        dimension === "direct" ?
          copilotHeaders(state)
        : { "content-type": "application/json", authorization: "Bearer dummy" },
      body: JSON.stringify(target.body),
    })
    const errorObject =
      body && typeof body === "object" ?
        (body as Record<string, unknown>).error
      : undefined
    return {
      case: probeCase.name,
      dimension,
      status: response.status,
      ok: response.ok,
      error:
        response.ok ? undefined : (
          JSON.stringify(errorObject ?? body ?? text.slice(0, 500))
        ),
      usage: extractUsage(body),
      copilotUsage: extractCopilotUsage(body),
      durationMs: Date.now() - started,
      headers: safeHeaders(response),
    }
  } catch (error) {
    return {
      case: probeCase.name,
      dimension,
      status: null,
      ok: false,
      error: error instanceof Error ? error.message : String(error),
      durationMs: Date.now() - started,
      headers: {},
    }
  }
}

interface PreparedCase {
  probeCase: ProbeCase
  content: string
  estimatedTokens: number
}

interface ReportRow {
  case: string
  estimatedInputTokens: number
  requestedOutputTokens: number
  classification: string
  direct?: ProbeResult
  proxy?: ProbeResult
  [key: string]: unknown
}

interface ContextReport {
  generatedAt: string
  executed: boolean
  model: Model
  endpoint: string
  via: string
  margin: number
  results: Array<ReportRow>
  usageBefore: unknown
  usageAfter: unknown
  creditDelta?: number
  costAttribution: string
}

function formatResult(result?: ProbeResult): string {
  if (!result) return "—"
  return String(result.status ?? result.error ?? "unknown")
}

function renderMarkdown(report: ContextReport): string {
  const lines = [
    `# Context Boundary Report — ${report.generatedAt}`,
    "",
    `- Model: \`${report.model.id}\``,
    `- Endpoint: \`${report.endpoint}\``,
    `- Executed: ${String(report.executed)}`,
    `- Cost attribution: ${report.costAttribution}`,
    `- Observed account credit delta: ${String(report.creditDelta ?? "unavailable")}`,
    "",
    "| Case | Estimate | Output requested | Direct | Proxy | Direct AIU | Proxy AIU | Classification |",
    "|---|---:|---:|---|---|---:|---:|---|",
  ]
  for (const item of report.results) {
    const directAiu =
      item.direct?.copilotUsage ?
        nanoAiuToAiu(item.direct.copilotUsage.total_nano_aiu).toFixed(6)
      : "—"
    const proxyAiu =
      item.proxy?.copilotUsage ?
        nanoAiuToAiu(item.proxy.copilotUsage.total_nano_aiu).toFixed(6)
      : "—"
    lines.push(
      `| ${item.case} | ${item.estimatedInputTokens} | ${item.requestedOutputTokens} | ${formatResult(item.direct)} | ${formatResult(item.proxy)} | ${directAiu} | ${proxyAiu} | ${item.classification} |`,
    )
  }
  lines.push(
    "",
    "## Caveats",
    "",
    "- Local token counts are estimates; provider usage is authoritative when returned.",
    "- Credit delta is account-level and may include concurrent activity or delayed accounting.",
    "- Per-request AIU is derived from provider-returned nano-AIU; no AIU-to-AIC conversion was inferred.",
  )
  return lines.join("\n")
}

async function prepareCases(
  model: Model,
  cases: Array<ProbeCase>,
): Promise<Array<PreparedCase>> {
  const prepared: Array<PreparedCase> = []
  for (const probeCase of cases) {
    if (probeCase.expectation === "not-applicable") {
      prepared.push({ probeCase, content: "", estimatedTokens: 0 })
      continue
    }
    const calibrated = await calibratePrompt(
      probeCase.targetInputTokens,
      async (content) => {
        const count = await getTokenCount(
          buildChatPayload(model.id, content, probeCase.requestedOutputTokens),
          model,
        )
        return count.input
      },
    )
    prepared.push({
      probeCase,
      content: calibrated.content,
      estimatedTokens: calibrated.estimatedTokens,
    })
  }
  return prepared
}

async function executeMatrix(
  model: Model,
  prepared: Array<PreparedCase>,
): Promise<Array<ReportRow>> {
  const results: Array<ReportRow> = []
  for (const item of prepared) {
    if (item.probeCase.expectation === "not-applicable") {
      results.push({
        case: item.probeCase.name,
        estimatedInputTokens: 0,
        requestedOutputTokens: 0,
        classification: "not-applicable",
        reason: item.probeCase.reason,
      })
      continue
    }
    let direct: ProbeResult | undefined
    let proxy: ProbeResult | undefined
    if (via === "direct" || via === "both") {
      direct = await runRequest(
        item.probeCase,
        "direct",
        directBody(model, item.content, item.probeCase.requestedOutputTokens),
      )
    }
    if (via === "proxy" || via === "both") {
      proxy = await runRequest(
        item.probeCase,
        "proxy",
        proxyBody(model, item.content, item.probeCase.requestedOutputTokens),
      )
    }
    results.push({
      case: item.probeCase.name,
      expectation: item.probeCase.expectation,
      targetInputTokens: item.probeCase.targetInputTokens,
      estimatedInputTokens: item.estimatedTokens,
      requestedOutputTokens: item.probeCase.requestedOutputTokens,
      direct,
      proxy,
      classification: classifyPair(direct, proxy),
    })
  }
  return results
}

function directBaseFromToken(token: string): string {
  const proxyClaim = token
    .split(";")
    .find((part) => part.startsWith("proxy-ep="))
    ?.slice("proxy-ep=".length)
  if (!proxyClaim) return "https://api.githubcopilot.com"
  return `https://${proxyClaim.replace(/^proxy\./, "api.")}`
}

function quotaSnapshot(usage: unknown): unknown {
  if (!usage || typeof usage !== "object") return undefined
  const record = usage as Record<string, unknown>
  return {
    copilot_plan: record.copilot_plan,
    quota_reset_date: record.quota_reset_date,
    token_based_billing: record.token_based_billing,
    premium_interactions:
      record.quota_snapshots && typeof record.quota_snapshots === "object" ?
        (record.quota_snapshots as Record<string, unknown>).premium_interactions
      : undefined,
  }
}

async function writeReports(report: ContextReport): Promise<void> {
  const reportDir = join(import.meta.dir, "reports", "context-boundary")
  await mkdir(reportDir, { recursive: true })
  const stamp = report.generatedAt.replaceAll(/[:.]/g, "-")
  const json = `${JSON.stringify(report, null, 2)}\n`
  const markdown = `${renderMarkdown(report)}\n`
  await Promise.all([
    writeFile(join(reportDir, `${stamp}.json`), json),
    writeFile(join(reportDir, `${stamp}.md`), markdown),
    writeFile(join(reportDir, "latest.json"), json),
    writeFile(join(reportDir, "latest.md"), markdown),
  ])
  console.log(`Reports written to ${reportDir}`)
}

async function main(): Promise<void> {
  const catalogResponse = await fetchJson(`${proxyUrl}/v1/models`, {
    headers: { authorization: "Bearer dummy" },
  })
  if (!catalogResponse.response.ok)
    throw new Error(
      `Failed to load proxy catalog: ${catalogResponse.response.status}`,
    )
  const models = catalogResponse.body as ModelsResponse
  const model = chooseModel(models)
  const endpoint = resolveEndpoint(model.id, models)
  const cases = buildProbeCases(model, margin).filter((item) =>
    selectedCases.has(item.name),
  )
  const prepared = await prepareCases(model, cases)

  console.log(
    JSON.stringify(
      {
        execute,
        model: model.id,
        endpoint,
        limits: model.capabilities.limits,
        cases: prepared.map((item) => ({
          case: item.probeCase.name,
          estimate: item.estimatedTokens,
          output: item.probeCase.requestedOutputTokens,
          expectation: item.probeCase.expectation,
        })),
      },
      null,
      2,
    ),
  )
  if (!execute) {
    console.log(
      "Dry run only. Re-run with --execute to send the minimal matrix.",
    )
    return
  }

  const githubToken = (
    await readFile(
      join(homedir(), ".local", "share", "copilot-api", "github_token"),
      "utf8",
    )
  ).trim()
  state.githubToken = githubToken
  const tokenResponse = await getCopilotToken()
  state.copilotToken = tokenResponse.token
  directBaseUrl = directBaseFromToken(tokenResponse.token)

  const beforeUsage = (await fetchJson(`${proxyUrl}/usage`)).body
  const results = await executeMatrix(model, prepared)
  const afterUsage = (await fetchJson(`${proxyUrl}/usage`)).body
  const delta = creditDelta(beforeUsage, afterUsage)
  const report: ContextReport = {
    generatedAt: new Date().toISOString(),
    executed: true,
    model,
    endpoint,
    via,
    margin,
    results,
    usageBefore: quotaSnapshot(beforeUsage),
    usageAfter: quotaSnapshot(afterUsage),
    creditDelta: delta,
    costAttribution: delta === undefined ? "unavailable" : "account-delta-only",
  }
  await writeReports(report)
}

await main()
