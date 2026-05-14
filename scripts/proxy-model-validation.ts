#!/usr/bin/env bun
/**
 * Proxy Model Validation Suite
 *
 * Tests all models through 3 dimensions:
 *   1. Direct (upstream) — baseline, what the API actually supports
 *   2. Proxy /v1/messages — Anthropic-format input, proxy autoroutes
 *   3. Proxy /v1/chat/completions — OpenAI-format input, proxy autoroutes
 *
 * Also runs proxy-specific translation tests and capability probes.
 *
 * Usage:
 *   bun run scripts/proxy-model-validation.ts
 *   bun run scripts/proxy-model-validation.ts --quick           # text-only smoke
 *   bun run scripts/proxy-model-validation.ts --models claude   # filter by name
 *   bun run scripts/proxy-model-validation.ts --capabilities    # run capability probes
 *   bun run scripts/proxy-model-validation.ts --all             # everything
 *
 * Requires: proxy running on localhost:4141
 */

import { writeFile } from "fs/promises"
import { join } from "path"
import {
  type CopilotModel,
  type ModelProfile,
  type TestResult,
  getJwt,
  fetchModels,
  filterChatModels,
  classifyModel,
  copilotHeaders,
  proxyHeaders,
  fmtMs,
  COPILOT_API_BASE_URL,
  PROXY_URL,
} from "/Users/jbencardino/Documents/Proyectos/ccexplore/development-repo/scripts/lib/copilot-test-lib"

// ── CLI args ─────────────────────────────────────────────────────────────────

const args = new Set(process.argv.slice(2))
const quickMode = args.has("--quick")
const runCapabilities = args.has("--capabilities") || args.has("--all")
const modelFilter =
  process.argv.find((a) => a.startsWith("--models="))?.split("=")[1] ??
  (args.has("--models")
    ? process.argv[process.argv.indexOf("--models") + 1]
    : undefined)

// ── Types ────────────────────────────────────────────────────────────────────

interface BlameResult {
  model: string
  test: string
  direct: "pass" | "fail" | "skip"
  proxyMessages: "pass" | "fail" | "skip"
  proxyChat: "pass" | "fail" | "skip"
  blame: "ok" | "upstream" | "proxy-bug" | "proxy-fix"
  detail?: string
  durationMs: number
}

interface CapabilityProbe {
  model: string
  probe: string
  status: "pass" | "fail" | "skip"
  detail?: string
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const PROXY_MSG_URL = PROXY_URL + "/v1/messages"
const PROXY_CHAT_URL = PROXY_URL + "/v1/chat/completions"

function chatHeaders(): Record<string, string> {
  return { "Content-Type": "application/json" }
}

async function safeFetch(
  url: string,
  opts: RequestInit,
): Promise<{ ok: boolean; status: number; body: string; json: unknown }> {
  try {
    const res = await fetch(url, { ...opts, signal: AbortSignal.timeout(30000) })
    const body = await res.text()
    let json: unknown
    try {
      json = JSON.parse(body)
    } catch {
      json = null
    }
    return { ok: res.ok, status: res.status, body, json }
  } catch (e) {
    return {
      ok: false,
      status: 0,
      body: String(e),
      json: null,
    }
  }
}

function extractText(json: unknown): string {
  const d = json as Record<string, unknown>
  // Anthropic
  const content = d?.content as Array<{ type: string; text?: string }> | undefined
  if (content?.[0]?.text) return content[0].text
  // OpenAI
  const choices = d?.choices as Array<{ message?: { content?: string } }> | undefined
  if (choices?.[0]?.message?.content) return choices[0].message.content
  // Responses
  const output = d?.output as Array<{ type: string; content?: Array<{ text?: string }> }> | undefined
  const msg = output?.find((o) => o.type === "message")
  if (msg?.content?.[0]?.text) return msg.content[0].text
  return ""
}

function hasToolUse(json: unknown): boolean {
  const d = json as Record<string, unknown>
  const content = d?.content as Array<{ type: string }> | undefined
  if (content?.some((c) => c.type === "tool_use")) return true
  const choices = d?.choices as Array<{ message?: { tool_calls?: unknown[] } }> | undefined
  if ((choices?.[0]?.message?.tool_calls?.length ?? 0) > 0) return true
  const output = d?.output as Array<{ type: string }> | undefined
  if (output?.some((o) => o.type === "function_call")) return true
  return false
}

// ── Test runners ─────────────────────────────────────────────────────────────

async function testText(
  profile: ModelProfile,
  url: string,
  headers: Record<string, string>,
  format: "anthropic" | "openai" | "native",
): Promise<TestResult> {
  const start = Date.now()
  let body: Record<string, unknown>

  if (format === "anthropic") {
    body = { model: profile.id, max_tokens: 16, messages: [{ role: "user", content: "Say PONG" }] }
  } else if (format === "native" && profile.endpoint === "/responses") {
    body = { model: profile.id, max_output_tokens: 16, input: [{ type: "message", role: "user", content: "Say PONG" }] }
  } else if (format === "native" && profile.endpoint === "/v1/messages") {
    body = { model: profile.id, max_tokens: 16, messages: [{ role: "user", content: "Say PONG" }] }
  } else {
    body = { model: profile.id, max_tokens: 16, messages: [{ role: "user", content: "Say PONG" }] }
  }

  const result = await safeFetch(url, { method: "POST", headers, body: JSON.stringify(body) })
  const text = extractText(result.json)
  const status = result.ok && text.length > 0 ? "pass" : "fail"
  return { test: "text", model: profile.id, endpoint: profile.endpoint, status, detail: status === "fail" ? `${result.status}: ${result.body.slice(0, 60)}` : undefined, durationMs: Date.now() - start }
}

async function testTools(
  profile: ModelProfile,
  url: string,
  headers: Record<string, string>,
  format: "anthropic" | "openai" | "native",
): Promise<TestResult> {
  if (!profile.toolSupport) return { test: "tools", model: profile.id, endpoint: profile.endpoint, status: "skip", detail: "no tool support", durationMs: 0 }
  const start = Date.now()

  const anthropicTool = { name: "ping", description: "Returns pong", input_schema: { type: "object", properties: { msg: { type: "string" } }, required: ["msg"] } }
  const openaiTool = { type: "function", function: { name: "ping", description: "Returns pong", parameters: { type: "object", properties: { msg: { type: "string" } }, required: ["msg"] } } }
  const responsesTool = { type: "function", name: "ping", description: "Returns pong", parameters: { type: "object", properties: { msg: { type: "string" } }, required: ["msg"] } }

  let body: Record<string, unknown>
  if (format === "anthropic") {
    body = { model: profile.id, max_tokens: 100, messages: [{ role: "user", content: 'Call the ping tool with msg "hello"' }], tools: [anthropicTool] }
  } else if (format === "native" && profile.endpoint === "/responses") {
    body = { model: profile.id, max_output_tokens: 100, input: [{ type: "message", role: "user", content: 'Call the ping tool with msg "hello"' }], tools: [responsesTool] }
  } else if (format === "native" && profile.endpoint === "/v1/messages") {
    body = { model: profile.id, max_tokens: 100, messages: [{ role: "user", content: 'Call the ping tool with msg "hello"' }], tools: [anthropicTool] }
  } else {
    body = { model: profile.id, max_tokens: 100, messages: [{ role: "user", content: 'Call the ping tool with msg "hello"' }], tools: [openaiTool] }
  }

  const result = await safeFetch(url, { method: "POST", headers, body: JSON.stringify(body) })
  const tools = result.ok && hasToolUse(result.json)
  return { test: "tools", model: profile.id, endpoint: profile.endpoint, status: tools ? "pass" : "fail", detail: tools ? undefined : `no tool_use (${result.status})`, durationMs: Date.now() - start }
}

async function testStream(
  profile: ModelProfile,
  url: string,
  headers: Record<string, string>,
  format: "anthropic" | "openai" | "native",
): Promise<TestResult> {
  const start = Date.now()
  let body: Record<string, unknown>

  if (format === "anthropic") {
    body = { model: profile.id, max_tokens: 16, messages: [{ role: "user", content: "Say hi" }], stream: true }
  } else if (format === "native" && profile.endpoint === "/responses") {
    body = { model: profile.id, max_output_tokens: 16, input: [{ type: "message", role: "user", content: "Say hi" }], stream: true }
  } else if (format === "native" && profile.endpoint === "/v1/messages") {
    body = { model: profile.id, max_tokens: 16, messages: [{ role: "user", content: "Say hi" }], stream: true }
  } else {
    body = { model: profile.id, max_tokens: 16, messages: [{ role: "user", content: "Say hi" }], stream: true }
  }

  const result = await safeFetch(url, { method: "POST", headers, body: JSON.stringify(body) })
  const hasEvents = result.body.includes("data:")
  return { test: "stream", model: profile.id, endpoint: profile.endpoint, status: hasEvents ? "pass" : "fail", detail: hasEvents ? undefined : `no SSE events (${result.status})`, durationMs: Date.now() - start }
}

// ── Direct endpoint URL resolver ─────────────────────────────────────────────

function directUrl(profile: ModelProfile): string {
  if (profile.endpoint === "/v1/messages") return COPILOT_API_BASE_URL + "/v1/messages"
  if (profile.endpoint === "/responses") return COPILOT_API_BASE_URL + "/responses"
  return COPILOT_API_BASE_URL + "/chat/completions"
}

function directFormat(profile: ModelProfile): "anthropic" | "openai" | "native" {
  if (profile.endpoint === "/v1/messages") return "native"
  if (profile.endpoint === "/responses") return "native"
  return "openai"
}

// ── Blame computation ────────────────────────────────────────────────────────

function computeBlame(direct: string, proxy: string): BlameResult["blame"] {
  if (direct === "pass" && proxy === "pass") return "ok"
  if (direct === "fail" && proxy === "fail") return "upstream"
  if (direct === "pass" && proxy === "fail") return "proxy-bug"
  if (direct === "fail" && proxy === "pass") return "proxy-fix"
  return "ok"
}

// ── Capability probes ────────────────────────────────────────────────────────

async function probeCapability(
  model: string,
  probe: string,
  url: string,
  headers: Record<string, string>,
  body: Record<string, unknown>,
): Promise<CapabilityProbe> {
  const result = await safeFetch(url, { method: "POST", headers, body: JSON.stringify(body) })
  const text = extractText(result.json)
  if (result.ok && text.length > 0) return { model, probe, status: "pass" }
  return { model, probe, status: "fail", detail: `${result.status}: ${result.body.slice(0, 60)}` }
}

async function runCapabilityProbes(
  jwt: string,
  profiles: ModelProfile[],
): Promise<CapabilityProbe[]> {
  const results: CapabilityProbe[] = []
  const hdrs = copilotHeaders(jwt)

  // Claude models: thinking type probes
  const claudeModels = profiles.filter((p) => p.isClaude)
  for (const p of claudeModels) {
    const url = COPILOT_API_BASE_URL + "/v1/messages"
    const base = { model: p.id, max_tokens: 2048, messages: [{ role: "user", content: "Say PONG" }] }

    console.log(`  Probing ${p.id}...`)

    results.push(await probeCapability(p.id, "disabled", url, hdrs, { ...base, thinking: { type: "disabled" } }))
    results.push(await probeCapability(p.id, "enabled+budget", url, hdrs, { ...base, thinking: { type: "enabled", budget_tokens: 1024 } }))
    results.push(await probeCapability(p.id, "adaptive", url, hdrs, { ...base, thinking: { type: "adaptive" } }))
    results.push(await probeCapability(p.id, "adaptive+budget", url, hdrs, { ...base, thinking: { type: "adaptive", budget_tokens: 1024 } }))

    // Effort probes
    results.push(await probeCapability(p.id, "effort:low", url, hdrs, { ...base, output_config: { effort: "low" } }))
    results.push(await probeCapability(p.id, "effort:high", url, hdrs, { ...base, output_config: { effort: "high" } }))

    // Temperature
    results.push(await probeCapability(p.id, "temperature", url, hdrs, { ...base, temperature: 0.5 }))
  }

  // GPT-5.x models: /responses probes
  const gpt5Models = profiles.filter((p) => p.endpoint === "/responses")
  for (const p of gpt5Models) {
    const url = COPILOT_API_BASE_URL + "/responses"
    const base = { model: p.id, max_output_tokens: 256, input: [{ type: "message", role: "user", content: "Say PONG" }] }

    console.log(`  Probing ${p.id}...`)

    results.push(await probeCapability(p.id, "reasoning:high", url, hdrs, { ...base, reasoning: { effort: "high" } }))
    results.push(await probeCapability(p.id, "temperature", url, hdrs, { ...base, temperature: 0.5 }))

    // Check for reasoning block in output
    const reasonResp = await safeFetch(url, { method: "POST", headers: hdrs, body: JSON.stringify({ ...base, reasoning: { effort: "high" } }) })
    const output = (reasonResp.json as Record<string, unknown>)?.output as Array<{ type: string }> | undefined
    const hasReasoning = output?.some((o) => o.type === "reasoning") ?? false
    results.push({ model: p.id, probe: "reasoning-block", status: hasReasoning ? "pass" : "fail", detail: hasReasoning ? undefined : "no reasoning block in output" })
  }

  return results
}

// ── Proxy translation tests ──────────────────────────────────────────────────

async function runTranslationTests(): Promise<TestResult[]> {
  const results: TestResult[] = []
  const hdrs = proxyHeaders()

  // 1. Thinking normalization: adaptive → enabled for older models
  // Uses max_tokens: 4096 to ensure budget_tokens fits (budget must be >= 1024 and < max_tokens)
  {
    const start = Date.now()
    const res = await safeFetch(PROXY_MSG_URL, { method: "POST", headers: hdrs, body: JSON.stringify({ model: "claude-haiku-4-5", max_tokens: 4096, thinking: { type: "adaptive" }, messages: [{ role: "user", content: "Say PONG" }] }) })
    const text = extractText(res.json)
    results.push({ test: "thinking-downgrade (older)", model: "claude-haiku-4.5", endpoint: "/v1/messages", status: res.ok && text.length > 0 ? "pass" : "fail", detail: res.ok ? undefined : `${res.status}: ${res.body.slice(0, 60)}`, durationMs: Date.now() - start })
  }

  // 2. Effort → suffix for opus-4.7
  {
    const start = Date.now()
    const res = await safeFetch(PROXY_MSG_URL, { method: "POST", headers: hdrs, body: JSON.stringify({ model: "claude-opus-4-7", max_tokens: 256, output_config: { effort: "high" }, messages: [{ role: "user", content: "Say PONG" }] }) })
    const text = extractText(res.json)
    results.push({ test: "effort→suffix (4.7)", model: "claude-opus-4.7", endpoint: "/v1/messages", status: res.ok && text.length > 0 ? "pass" : "fail", detail: res.ok ? undefined : `${res.status}: ${res.body.slice(0, 60)}`, durationMs: Date.now() - start })
  }

  // 3. Effort → param for opus-4.6
  {
    const start = Date.now()
    const res = await safeFetch(PROXY_MSG_URL, { method: "POST", headers: hdrs, body: JSON.stringify({ model: "claude-opus-4-6", max_tokens: 256, output_config: { effort: "high" }, messages: [{ role: "user", content: "Say PONG" }] }) })
    const text = extractText(res.json)
    results.push({ test: "effort→param (4.6)", model: "claude-opus-4.6", endpoint: "/v1/messages", status: res.ok && text.length > 0 ? "pass" : "fail", detail: res.ok ? undefined : `${res.status}: ${res.body.slice(0, 60)}`, durationMs: Date.now() - start })
  }

  // 4. anthropic-beta 1M header
  {
    const start = Date.now()
    const h = { ...hdrs, "anthropic-beta": "context-1m-2025-08-07" }
    const res = await safeFetch(PROXY_MSG_URL, { method: "POST", headers: h, body: JSON.stringify({ model: "claude-opus-4-6", max_tokens: 64, messages: [{ role: "user", content: "Say PONG" }] }) })
    const text = extractText(res.json)
    results.push({ test: "1m-header-upgrade", model: "claude-opus-4.6", endpoint: "/v1/messages", status: res.ok && text.length > 0 ? "pass" : "fail", detail: res.ok ? undefined : `${res.status}: ${res.body.slice(0, 60)}`, durationMs: Date.now() - start })
  }

  // 5. GPT-5.5 via /v1/messages (responses-via-messages routing)
  {
    const start = Date.now()
    const res = await safeFetch(PROXY_MSG_URL, { method: "POST", headers: hdrs, body: JSON.stringify({ model: "gpt-5.5", max_tokens: 64, messages: [{ role: "user", content: "Say PONG" }] }) })
    const text = extractText(res.json)
    results.push({ test: "responses-via-messages", model: "gpt-5.5", endpoint: "/v1/messages", status: res.ok && text.length > 0 ? "pass" : "fail", detail: res.ok ? undefined : `${res.status}: ${res.body.slice(0, 60)}`, durationMs: Date.now() - start })
  }

  // 6. GPT-5.5 via /chat/completions (responses routing)
  {
    const start = Date.now()
    const res = await safeFetch(PROXY_CHAT_URL, { method: "POST", headers: chatHeaders(), body: JSON.stringify({ model: "gpt-5.5", max_tokens: 64, messages: [{ role: "user", content: "Say PONG" }] }) })
    const text = extractText(res.json)
    results.push({ test: "responses-via-chat", model: "gpt-5.5", endpoint: "/chat/completions", status: res.ok && text.length > 0 ? "pass" : "fail", detail: res.ok ? undefined : `${res.status}: ${res.body.slice(0, 60)}`, durationMs: Date.now() - start })
  }

  return results
}

// ── Report ───────────────────────────────────────────────────────────────────

function generateReport(
  models: CopilotModel[],
  profiles: ModelProfile[],
  blameResults: BlameResult[],
  translationResults: TestResult[],
  capabilityResults: CapabilityProbe[],
): string {
  const now = new Date().toISOString().split("T")[0]
  const allSmoke = blameResults.length
  const smokePass = blameResults.filter((r) => r.blame === "ok" || r.blame === "proxy-fix").length
  const proxyBugs = blameResults.filter((r) => r.blame === "proxy-bug").length
  const upstreamIssues = blameResults.filter((r) => r.blame === "upstream").length
  const transPass = translationResults.filter((r) => r.status === "pass").length
  const capPass = capabilityResults.filter((r) => r.status === "pass").length
  const totalTests = allSmoke + translationResults.length + capabilityResults.length

  const lines: string[] = [
    `# Proxy Model Validation Report — ${now}`,
    "",
    "## Summary",
    `- Models discovered: ${models.length}`,
    `- Models tested: ${profiles.length}`,
    `- Tests: ${allSmoke} smoke + ${translationResults.length} translation + ${capabilityResults.length} capability = ${totalTests} total`,
    `- Smoke: ${smokePass} ok, ${proxyBugs} proxy bugs, ${upstreamIssues} upstream limitations`,
    `- Translation: ${transPass}/${translationResults.length} pass`,
    `- Capability: ${capPass}/${capabilityResults.length} pass`,
    "",
    "## Model Profiles",
    "",
    "| Model | Endpoint | Tools | Thinking | Effort | Temp | Max Output |",
    "|-------|----------|-------|----------|--------|------|------------|",
  ]

  for (const p of profiles) {
    lines.push(`| ${p.id} | ${p.endpoint} | ${p.toolSupport ? "✅" : "❌"} | ${p.thinkingSupport} | ${p.effortSupport} | ${p.temperatureSupport ? "✅" : "❌"} | ${p.maxOutputTokens} |`)
  }

  // Smoke tests — blame matrix
  lines.push("", "## Smoke Tests", "")
  lines.push("| Model | Test | Direct | Proxy /msg | Proxy /chat | Blame |")
  lines.push("|-------|------|--------|-----------|-------------|-------|")

  for (const r of blameResults) {
    const icon = (s: string) => (s === "pass" ? "✅" : s === "skip" ? "⬜" : "❌")
    const blameIcon = r.blame === "ok" ? "✅" : r.blame === "upstream" ? "⚠️" : r.blame === "proxy-bug" ? "🐛" : "🤔"
    lines.push(`| ${r.model} | ${r.test} | ${icon(r.direct)} | ${icon(r.proxyMessages)} | ${icon(r.proxyChat)} | ${blameIcon} ${r.blame} |`)
  }

  // Translation tests
  lines.push("", "## Proxy Translation Tests", "")
  lines.push("| Test | Model | Status | Detail | Duration |")
  lines.push("|------|-------|--------|--------|----------|")
  for (const r of translationResults) {
    const icon = r.status === "pass" ? "✅" : "❌"
    lines.push(`| ${r.test} | ${r.model} | ${icon} | ${r.detail ?? ""} | ${fmtMs(r.durationMs)} |`)
  }

  // Capability matrix
  if (capabilityResults.length > 0) {
    lines.push("", "## Capability Matrix", "")
    const probeNames = [...new Set(capabilityResults.map((r) => r.probe))]
    lines.push("| Model | " + probeNames.join(" | ") + " |")
    lines.push("|-------|" + probeNames.map(() => "---").join("|") + "|")

    const modelIds = [...new Set(capabilityResults.map((r) => r.model))]
    for (const mid of modelIds) {
      const cells = probeNames.map((p) => {
        const r = capabilityResults.find((c) => c.model === mid && c.probe === p)
        if (!r) return "—"
        return r.status === "pass" ? "✅" : "❌"
      })
      lines.push(`| ${mid} | ${cells.join(" | ")} |`)
    }
  }

  // Failures
  const bugs = blameResults.filter((r) => r.blame === "proxy-bug")
  if (bugs.length > 0) {
    lines.push("", "## Proxy Bugs (pass direct, fail proxy)", "")
    for (const f of bugs) lines.push(`- **${f.model}** / ${f.test}: ${f.detail ?? "unknown"}`)
  }

  const upstream = blameResults.filter((r) => r.blame === "upstream")
  if (upstream.length > 0) {
    lines.push("", "## Upstream Limitations (fail both)", "")
    for (const f of upstream) lines.push(`- **${f.model}** / ${f.test}: ${f.detail ?? "unknown"}`)
  }

  lines.push("", "---", `Generated by proxy-model-validation.ts`)
  return lines.join("\n")
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log("═══════════════════════════════════════════════════════════")
  console.log(" Proxy Model Validation Suite")
  console.log("═══════════════════════════════════════════════════════════\n")

  // Auth
  const jwt = await getJwt()
  console.log("✅ Authenticated\n")

  // Check proxy
  try {
    const health = await safeFetch(PROXY_URL + "/health", { method: "GET", headers: {} })
    if (!health.ok) throw new Error("proxy not responding")
    console.log("✅ Proxy reachable\n")
  } catch {
    console.error("❌ Proxy not reachable at", PROXY_URL)
    console.error("   Start with: bun run dev start --port 4141")
    process.exit(1)
  }

  // Phase 1: Discovery
  console.log("Phase 1: Fetching models...")
  const allModels = await fetchModels(jwt)
  let chatModels = filterChatModels(allModels)
  if (modelFilter) chatModels = chatModels.filter((m) => m.id.includes(modelFilter))
  // Skip variants for smoke tests (test base models only)
  chatModels = chatModels.filter((m) => !m.id.endsWith("-high") && !m.id.endsWith("-xhigh") && !m.id.endsWith("-internal"))

  const profiles = chatModels.map(classifyModel)
  console.log(`  Found ${allModels.length} total, testing ${profiles.length} chat models\n`)

  // Phase 2: Smoke tests (3 dimensions)
  console.log("Phase 2: Smoke tests (Direct + Proxy /messages + Proxy /chat)...\n")
  const blameResults: BlameResult[] = []
  const hdrs = copilotHeaders(jwt)

  for (const profile of profiles) {
    process.stdout.write(`  ${profile.id.padEnd(25)}`)

    // Text test across 3 dimensions
    const directText = await testText(profile, directUrl(profile), hdrs, directFormat(profile))
    const proxyMsgText = await testText(profile, PROXY_MSG_URL, proxyHeaders(), "anthropic")
    const proxyChatText = await testText(profile, PROXY_CHAT_URL, chatHeaders(), "openai")

    const textBlame = computeBlame(directText.status, proxyMsgText.status === "pass" && proxyChatText.status === "pass" ? "pass" : "fail")
    blameResults.push({
      model: profile.id, test: "text",
      direct: directText.status, proxyMessages: proxyMsgText.status, proxyChat: proxyChatText.status,
      blame: textBlame, detail: proxyChatText.detail ?? proxyMsgText.detail ?? directText.detail,
      durationMs: directText.durationMs + proxyMsgText.durationMs + proxyChatText.durationMs,
    })

    const tIcon = (s: string) => (s === "pass" ? "✅" : s === "skip" ? "⬜" : "❌")
    process.stdout.write(`text: ${tIcon(directText.status)}${tIcon(proxyMsgText.status)}${tIcon(proxyChatText.status)}`)

    if (!quickMode) {
      // Tools
      const directTool = await testTools(profile, directUrl(profile), hdrs, directFormat(profile))
      const proxyMsgTool = await testTools(profile, PROXY_MSG_URL, proxyHeaders(), "anthropic")
      const proxyChatTool = await testTools(profile, PROXY_CHAT_URL, chatHeaders(), "openai")

      const toolBlame = computeBlame(directTool.status, proxyMsgTool.status === "pass" && proxyChatTool.status === "pass" ? "pass" : proxyMsgTool.status === "skip" ? "skip" : "fail")
      blameResults.push({
        model: profile.id, test: "tools",
        direct: directTool.status, proxyMessages: proxyMsgTool.status, proxyChat: proxyChatTool.status,
        blame: toolBlame, detail: proxyChatTool.detail ?? proxyMsgTool.detail,
        durationMs: directTool.durationMs + proxyMsgTool.durationMs + proxyChatTool.durationMs,
      })
      process.stdout.write(` tools: ${tIcon(directTool.status)}${tIcon(proxyMsgTool.status)}${tIcon(proxyChatTool.status)}`)

      // Stream
      const directStream = await testStream(profile, directUrl(profile), hdrs, directFormat(profile))
      const proxyMsgStream = await testStream(profile, PROXY_MSG_URL, proxyHeaders(), "anthropic")
      const proxyChatStream = await testStream(profile, PROXY_CHAT_URL, chatHeaders(), "openai")

      const streamBlame = computeBlame(directStream.status, proxyMsgStream.status === "pass" && proxyChatStream.status === "pass" ? "pass" : "fail")
      blameResults.push({
        model: profile.id, test: "stream",
        direct: directStream.status, proxyMessages: proxyMsgStream.status, proxyChat: proxyChatStream.status,
        blame: streamBlame, detail: proxyChatStream.detail ?? proxyMsgStream.detail,
        durationMs: directStream.durationMs + proxyMsgStream.durationMs + proxyChatStream.durationMs,
      })
      process.stdout.write(` stream: ${tIcon(directStream.status)}${tIcon(proxyMsgStream.status)}${tIcon(proxyChatStream.status)}`)
    }

    console.log()
  }

  // Phase 3: Proxy translation tests
  console.log("\nPhase 3: Proxy translation tests...")
  const translationResults = await runTranslationTests()
  for (const r of translationResults) {
    const icon = r.status === "pass" ? "✅" : "❌"
    console.log(`  ${icon} ${r.test} (${r.model})`)
  }

  // Phase 4: Capability probes
  let capabilityResults: CapabilityProbe[] = []
  if (runCapabilities) {
    console.log("\nPhase 4: Capability probes (direct upstream)...")
    capabilityResults = await runCapabilityProbes(jwt, profiles)
  }

  // Phase 5: Report
  const report = generateReport(allModels, profiles, blameResults, translationResults, capabilityResults)
  const reportPath = join(import.meta.dir, "reports", "proxy-validation-latest.md")
  await writeFile(reportPath, report)
  console.log(`\n📄 Report: ${reportPath}`)

  // Also write capability matrix as JSON
  if (capabilityResults.length > 0) {
    const jsonPath = join(import.meta.dir, "reports", "capability-matrix.json")
    await writeFile(jsonPath, JSON.stringify(capabilityResults, null, 2))
    console.log(`📊 Capability matrix: ${jsonPath}`)
  }

  // Summary
  const bugs = blameResults.filter((r) => r.blame === "proxy-bug").length
  const ok = blameResults.filter((r) => r.blame === "ok" || r.blame === "proxy-fix").length
  console.log(`\n═══════════════════════════════════════════════════════════`)
  console.log(` Results: ${ok} ok, ${bugs} proxy bugs, ${blameResults.filter((r) => r.blame === "upstream").length} upstream`)
  console.log(`═══════════════════════════════════════════════════════════`)

  if (bugs > 0) process.exit(1)
}

main().catch((e) => {
  console.error("Fatal:", e)
  process.exit(1)
})
