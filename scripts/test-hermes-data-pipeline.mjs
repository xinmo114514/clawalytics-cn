import yaml from "yaml"
import assert from "node:assert/strict"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import Database from "better-sqlite3"
import { HermesDataSourceAdapter } from "../src/server/parser/hermes/adapter.ts"
import { DEFAULT_CONFIG } from "../src/server/config/defaults.ts"
import { initializeAnalyticsService, shutdownAnalyticsService } from "../src/server/services/analytics-service.ts"


const root = fs.mkdtempSync(path.join(os.tmpdir(), "clawalytics-hermes-"))
function createSessionsTable(database) {
  database.exec("CREATE TABLE sessions (id TEXT PRIMARY KEY, source TEXT, model TEXT, started_at REAL NOT NULL, ended_at REAL, last_activity_at REAL, cwd TEXT, input_tokens INTEGER DEFAULT 0, output_tokens INTEGER DEFAULT 0, cache_read_tokens INTEGER DEFAULT 0, cache_write_tokens INTEGER DEFAULT 0, reasoning_tokens INTEGER DEFAULT 0, api_call_count INTEGER DEFAULT 0)")
}
try {
  const databasePath = path.join(root, "state.db")
  const database = new Database(databasePath)
  createSessionsTable(database)

  database.exec("CREATE TABLE session_model_usage (session_id TEXT NOT NULL, model TEXT NOT NULL, billing_provider TEXT NOT NULL DEFAULT '', billing_base_url TEXT NOT NULL DEFAULT '', billing_mode TEXT NOT NULL DEFAULT '', task TEXT NOT NULL DEFAULT '', api_call_count INTEGER NOT NULL DEFAULT 0, input_tokens INTEGER NOT NULL DEFAULT 0, output_tokens INTEGER NOT NULL DEFAULT 0, cache_read_tokens INTEGER NOT NULL DEFAULT 0, cache_write_tokens INTEGER NOT NULL DEFAULT 0, reasoning_tokens INTEGER NOT NULL DEFAULT 0, first_seen REAL, last_seen REAL)")
  const insertSession = database.prepare("INSERT INTO sessions VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
  insertSession.run("same-id", "qqbot", "deepseek-v4-flash", 1788000000, null, 1788000100, "/workspace/a", 100, 20, 1000, 0, 5, 2)
  insertSession.run("mimo-legacy", "cli", "mimo-v2.5", 1788000200, null, 1788000300, null, 50, 10, 500, 0, 3, 1)
  insertSession.run("casing", "cli", "minimax-m3", 1788000310, null, 1788000400, null, 60, 12, 600, 0, 4, 1)
  insertSession.run("unknown", "cron", "unpriced-model", 1788000400, null, 1788000500, null, 7, 2, 0, 0, 0, 1)
  const insertUsage = database.prepare("INSERT INTO session_model_usage VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
  insertUsage.run("same-id", "deepseek-v4-flash", "custom", "", "", "", 2, 90, 20, 900, 0, 5, 1788000001, 1788000090)
  insertUsage.run("same-id", "agnes-2.5-flash", "custom", "", "", "title_generation", 1, 5, 2, 3, 0, 1, 1788000002, 1788000095)
  database.close()

  const adapter = new HermesDataSourceAdapter(root)
  const result = adapter.scan()
  assert.equal(result.sessionCount, 4)
  assert.equal(result.usageRecordCount, 2)
  const mixed = result.sessions.get("hermes:same-id")
  assert.ok(mixed)
  assert.equal(mixed.sourceType, "hermes")
  assert.equal(mixed.usageGranularity, "aggregate")
  assert.equal(mixed.channel, "qqbot")
  assert.equal(mixed.totalInputTokens, 100)
  assert.equal(mixed.totalOutputTokens, 22)
  assert.equal(mixed.totalReasoningTokens, 6)
  assert.equal(mixed.apiCallCount, 3)
  assert.equal(mixed.requests.length, 3)
  assert.ok(mixed.totalCost > 0)
  const mimoSession = result.sessions.get("hermes:mimo-legacy")
  assert.ok(mimoSession)
  assert.equal(mimoSession.requests.length, 1)
  assert.equal(mimoSession.requests[0].provider, "xiaomi")
  assert.equal(mimoSession.requests[0].costStatus, "estimated")
  assert.equal(mimoSession.apiCallCount, 1)

  const casing = result.sessions.get("hermes:casing")
  assert.ok(casing)
  const casingRequest = casing.requests.find((request) => request.model === "minimax-m3")
  assert.ok(casingRequest)
  assert.equal(casingRequest.provider, "minimax")
  assert.equal(casingRequest.costStatus, "estimated")
  assert.ok((casingRequest.cost ?? 0) > 0)
  const unknown = result.sessions.get("hermes:unknown")
  assert.ok(unknown)
  assert.equal(unknown.totalCost, 0)
  assert.equal(unknown.costStatus, "unknown")
  const openClawRoot = path.join(root, "openclaw")
  const openClawSessions = path.join(openClawRoot, "agents", "main", "sessions")
  fs.mkdirSync(openClawSessions, { recursive: true })
  fs.writeFileSync(path.join(openClawRoot, "openclaw.json"), JSON.stringify({ agents: [{ id: "main", name: "Main" }] }))
  const jsonl = JSON.stringify({ type: "message", timestamp: "2026-08-29T00:00:00.000Z", message: { role: "assistant", provider: "deepseek", model: "deepseek-v4-flash", usage: { input: 11, output: 3, cacheRead: 5, cacheWrite: 0 } } })
  fs.writeFileSync(path.join(openClawSessions, "same-id.jsonl"), jsonl + String.fromCharCode(10))
  const service = initializeAnalyticsService({ ...DEFAULT_CONFIG, dataSources: { openclaw: { enabled: true, environment: "local", path: openClawRoot }, hermes: { enabled: true, environment: "local", path: root } }, openClawPath: openClawRoot })
  await service.refreshNow()
  assert.equal(service.getSessionCount(), 5)
  assert.equal(service.runWithSourceFilter("openclaw", () => service.getSessionCount()), 1)
  assert.equal(service.runWithSourceFilter("hermes", () => service.getSessionCount()), 4)
  const publicIds = service.getSessions().map((session) => session.id)
  assert.ok(publicIds.includes("openclaw:main:same-id"))
  assert.ok(publicIds.includes("hermes:same-id"))
  const allTokens = service.getTokenSummary().lifetime.total
  const openClawTokens = service.runWithSourceFilter("openclaw", () => service.getTokenSummary().lifetime.total)
  const hermesTokens = service.runWithSourceFilter("hermes", () => service.getTokenSummary().lifetime.total)
  assert.equal(allTokens, openClawTokens + hermesTokens)
  await shutdownAnalyticsService()
  const legacyRoot = fs.mkdtempSync(path.join(os.tmpdir(), "clawalytics-hermes-legacy-"))
  try {
    const legacyDatabase = new Database(path.join(legacyRoot, "state.db"))
    createSessionsTable(legacyDatabase)
    legacyDatabase.prepare("INSERT INTO sessions VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").run("old", "cli", "gpt-5.6-luna", 1788000000, null, 1788000010, null, 10, 2, 20, 0, 1, 1)
    legacyDatabase.close()
    const legacyResult = new HermesDataSourceAdapter(legacyRoot).scan()
    assert.equal(legacyResult.sessionCount, 1)
    assert.equal(legacyResult.usageRecordCount, 0)
    assert.equal(legacyResult.sessions.get("hermes:old")?.apiCallCount, 1)
  } finally { fs.rmSync(legacyRoot, { recursive: true, force: true }) }

  // A Hermes aggregate record that represents 5 API calls must be counted as
  // 5 in every request-count surface. Prior to the fix getModelDailyUsage,
  // getAgentDailyCosts, and getAllAgentsDailyCosts all incremented the
  // request counter per parsed record, silently dropping the 4 extra calls
  // each time an aggregate row covered multiple turns.
  const aggregateRoot = fs.mkdtempSync(path.join(os.tmpdir(), "clawalytics-aggregate-"))
  try {
    const aggregateDb = new Database(path.join(aggregateRoot, "state.db"))
    createSessionsTable(aggregateDb)
    aggregateDb.exec("CREATE TABLE session_model_usage (session_id TEXT NOT NULL, model TEXT NOT NULL, billing_provider TEXT NOT NULL DEFAULT '', billing_base_url TEXT NOT NULL DEFAULT '', billing_mode TEXT NOT NULL DEFAULT '', task TEXT NOT NULL DEFAULT '', api_call_count INTEGER NOT NULL DEFAULT 0, input_tokens INTEGER NOT NULL DEFAULT 0, output_tokens INTEGER NOT NULL DEFAULT 0, cache_read_tokens INTEGER NOT NULL DEFAULT 0, cache_write_tokens INTEGER NOT NULL DEFAULT 0, reasoning_tokens INTEGER NOT NULL DEFAULT 0, first_seen REAL, last_seen REAL)")
    aggregateDb.prepare("INSERT INTO sessions VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").run("agg", "cli", "deepseek-v4-flash", 1788000000, null, 1788000100, null, 90, 20, 0, 0, 0, 5)
    aggregateDb.prepare("INSERT INTO session_model_usage VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").run("agg", "deepseek-v4-flash", "custom", "", "", "", 5, 90, 20, 0, 0, 0, 1788000001, 1788000090)
    aggregateDb.close()
    const aggregateService = initializeAnalyticsService({ ...DEFAULT_CONFIG, dataSources: { openclaw: { enabled: false, environment: "local", path: "" }, hermes: { enabled: true, environment: "local", path: aggregateRoot } }, openClawPath: "" })
    await aggregateService.refreshNow()
    const modelDaily = aggregateService.getModelDailyUsage(30)
    const modelTotal = modelDaily.reduce((sum, entry) => sum + entry.requestCount, 0)
    assert.equal(modelTotal, 5, "model daily request count must include all 5 calls")
    const agentDaily = aggregateService.getAgentDailyCosts("hermes", 30)
    const agentTotal = agentDaily.reduce((sum, entry) => sum + entry.request_count, 0)
    assert.equal(agentTotal, 5, "agent daily request count must include all 5 calls")
    const allAgentsDaily = aggregateService.getAllAgentsDailyCosts(30)
    const allAgentsTotal = allAgentsDaily.reduce((sum, entry) => sum + entry.request_count, 0)
    assert.equal(allAgentsTotal, 5, "all-agents daily request count must include all 5 calls")
    await shutdownAnalyticsService()
    // Explicit 0 must be preserved (zero-call residual records do not become 1).
    const zeroCallRoot = fs.mkdtempSync(path.join(os.tmpdir(), "clawalytics-zero-call-"))
    const zeroCallDb = new Database(path.join(zeroCallRoot, "state.db"))
    createSessionsTable(zeroCallDb)
    zeroCallDb.exec("CREATE TABLE session_model_usage (session_id TEXT NOT NULL, model TEXT NOT NULL, billing_provider TEXT NOT NULL DEFAULT '', billing_base_url TEXT NOT NULL DEFAULT '', billing_mode TEXT NOT NULL DEFAULT '', task TEXT NOT NULL DEFAULT '', api_call_count INTEGER NOT NULL DEFAULT 0, input_tokens INTEGER NOT NULL DEFAULT 0, output_tokens INTEGER NOT NULL DEFAULT 0, cache_read_tokens INTEGER NOT NULL DEFAULT 0, cache_write_tokens INTEGER NOT NULL DEFAULT 0, reasoning_tokens INTEGER NOT NULL DEFAULT 0, first_seen REAL, last_seen REAL)")
    zeroCallDb.prepare("INSERT INTO sessions VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").run("zero", "cli", "deepseek-v4-flash", 1788000000, null, 1788000100, null, 0, 0, 0, 0, 0, 0)
    zeroCallDb.prepare("INSERT INTO session_model_usage VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").run("zero", "deepseek-v4-flash", "custom", "", "", "", 0, 0, 0, 0, 0, 0, 1788000001, 1788000090)
    zeroCallDb.close()
    const zeroCallService = initializeAnalyticsService({ ...DEFAULT_CONFIG, dataSources: { openclaw: { enabled: false, environment: "local", path: "" }, hermes: { enabled: true, environment: "local", path: zeroCallRoot } }, openClawPath: "" })
    await zeroCallService.refreshNow()
    const zeroModel = zeroCallService.getModelDailyUsage(30).reduce((sum, entry) => sum + entry.requestCount, 0)
    assert.equal(zeroModel, 0, "explicit zero apiCallCount must stay zero in daily totals")
    await shutdownAnalyticsService()
    fs.rmSync(zeroCallRoot, { recursive: true, force: true })
  } finally { fs.rmSync(aggregateRoot, { recursive: true, force: true }) }

  // Hermes-only agent lists must not surface pre-loaded OpenClaw agent shells
  // (zero-cost rows). The agent map is hydrated from the OpenClaw filesystem
  // layout, which has no bearing on the Hermes source - skipping it under the
  // 'hermes' filter keeps each source's agent inventory self-contained.
  const isolationRoot = fs.mkdtempSync(path.join(os.tmpdir(), "clawalytics-isolation-"))
  try {
    const isolationOpenClaw = path.join(isolationRoot, "openclaw")
    const isolationOpenClawSessions = path.join(isolationOpenClaw, "agents", "main", "sessions")
    fs.mkdirSync(isolationOpenClawSessions, { recursive: true })
    fs.writeFileSync(path.join(isolationOpenClaw, "openclaw.json"), JSON.stringify({ agents: [{ id: "main", name: "Main" }] }))
    fs.writeFileSync(
      path.join(isolationOpenClawSessions, "main.jsonl"),
      JSON.stringify({ type: "message", timestamp: "2026-08-29T00:00:00.000Z", message: { role: "assistant", provider: "deepseek", model: "deepseek-v4-flash", usage: { input: 1, output: 1, cacheRead: 0, cacheWrite: 0 } } }) + String.fromCharCode(10),
      "utf8"
    )
    const isolationHermesDb = new Database(path.join(isolationRoot, "state.db"))
    isolationHermesDb.exec("CREATE TABLE sessions (id TEXT PRIMARY KEY, source TEXT, model TEXT, started_at REAL NOT NULL, ended_at REAL, last_activity_at REAL, cwd TEXT, input_tokens INTEGER DEFAULT 0, output_tokens INTEGER DEFAULT 0, cache_read_tokens INTEGER DEFAULT 0, cache_write_tokens INTEGER DEFAULT 0, reasoning_tokens INTEGER DEFAULT 0, api_call_count INTEGER DEFAULT 0)")
    isolationHermesDb.exec("CREATE TABLE session_model_usage (session_id TEXT NOT NULL, model TEXT NOT NULL, billing_provider TEXT NOT NULL DEFAULT '', billing_base_url TEXT NOT NULL DEFAULT '', billing_mode TEXT NOT NULL DEFAULT '', task TEXT NOT NULL DEFAULT '', api_call_count INTEGER NOT NULL DEFAULT 0, input_tokens INTEGER NOT NULL DEFAULT 0, output_tokens INTEGER NOT NULL DEFAULT 0, cache_read_tokens INTEGER NOT NULL DEFAULT 0, cache_write_tokens INTEGER NOT NULL DEFAULT 0, reasoning_tokens INTEGER NOT NULL DEFAULT 0, first_seen REAL, last_seen REAL)")
    isolationHermesDb.prepare("INSERT INTO sessions VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").run("h-only", "cli", "mimo-v2.5", 1788000000, null, 1788000100, null, 10, 5, 0, 0, 0, 1)
    isolationHermesDb.prepare("INSERT INTO session_model_usage VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").run("h-only", "mimo-v2.5", "custom", "", "", "", 1, 10, 5, 0, 0, 0, 1788000001, 1788000090)
    isolationHermesDb.close()
    const isolationService = initializeAnalyticsService({ ...DEFAULT_CONFIG, dataSources: { openclaw: { enabled: true, environment: "local", path: isolationOpenClaw }, hermes: { enabled: true, environment: "local", path: isolationRoot } }, openClawPath: isolationOpenClaw })
    await isolationService.refreshNow()
    const openclawAgents = isolationService.runWithSourceFilter("openclaw", () => isolationService.getAgents().map((agent) => agent.id))
    const hermesAgents = isolationService.runWithSourceFilter("hermes", () => isolationService.getAgents().map((agent) => agent.id))
    assert.ok(openclawAgents.includes("main"), "openclaw source filter must surface OpenClaw agents")
    assert.ok(!hermesAgents.includes("main"), "hermes source filter must not leak OpenClaw agents")
    assert.ok(hermesAgents.includes("hermes"), "hermes source filter must surface the Hermes agent")
    await shutdownAnalyticsService()
  } finally { fs.rmSync(isolationRoot, { recursive: true, force: true }) }
  
  // A successful Hermes refresh must schedule the same debounced budget +
  // anomaly checks as the OpenClaw publish step, otherwise alerts lag until
  // the next OpenClaw event. Install a tiny daily budget, refresh, and
  // assert that a budget alert lands in the SQLite alerts table after the
  // 5-second debounce.
  const triggerRoot = fs.mkdtempSync(path.join(os.tmpdir(), "clawalytics-trigger-"))
  const triggerDb = new Database(path.join(triggerRoot, "state.db"))
  const triggerEpoch = Math.floor(Date.now() / 1000) - 60
  createSessionsTable(triggerDb)
  triggerDb.exec("CREATE TABLE session_model_usage (session_id TEXT NOT NULL, model TEXT NOT NULL, billing_provider TEXT NOT NULL DEFAULT '', billing_base_url TEXT NOT NULL DEFAULT '', billing_mode TEXT NOT NULL DEFAULT '', task TEXT NOT NULL DEFAULT '', api_call_count INTEGER NOT NULL DEFAULT 0, input_tokens INTEGER NOT NULL DEFAULT 0, output_tokens INTEGER NOT NULL DEFAULT 0, cache_read_tokens INTEGER NOT NULL DEFAULT 0, cache_write_tokens INTEGER NOT NULL DEFAULT 0, reasoning_tokens INTEGER NOT NULL DEFAULT 0, first_seen REAL, last_seen REAL)")
  triggerDb.prepare("INSERT INTO sessions VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").run("trigger", "cli", "mimo-v2.5", triggerEpoch, null, triggerEpoch, null, 100_000_000, 1, 0, 0, 0, 1)
  triggerDb.prepare("INSERT INTO session_model_usage VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").run("trigger", "mimo-v2.5", "custom", "", "", "", 1, 100_000_000, 1, 0, 0, 0, triggerEpoch, triggerEpoch)
  triggerDb.close()
  const configDir = path.join(os.homedir(), ".clawalytics")
  fs.mkdirSync(configDir, { recursive: true })
  const configPath = path.join(configDir, "config.yaml")
  const configBackup = fs.existsSync(configPath) ? fs.readFileSync(configPath, "utf8") : null
  const { closeDatabase } = await import('../src/server/db/schema.ts')
  try {
    fs.writeFileSync(
      configPath,
      yaml.stringify({
        schemaVersion: 3,
        currency: "CNY",
        dataSources: {
          openclaw: { enabled: false, environment: "local", path: "" },
          hermes: { enabled: true, environment: "local", path: triggerRoot },
        },
        rates: {},
        alertThresholds: { dailyBudget: 1, weeklyBudget: 0, monthlyBudget: 0 },
        openClawPath: "",
        gatewayLogsPath: "/tmp/openclaw",
        wsl: { enabled: false, distro: "", openClawPath: "" },
        securityAlertsEnabled: true,
        pricingEndpoint: null,
      }),
      "utf8"
    )
    const triggerService = initializeAnalyticsService({ ...DEFAULT_CONFIG, dataSources: { openclaw: { enabled: false, environment: "local", path: "" }, hermes: { enabled: true, environment: "local", path: triggerRoot } }, openClawPath: "", alertThresholds: { dailyBudget: 1, weeklyBudget: 0, monthlyBudget: 0 } })
    const { getAlertsByType } = await import(
      '../src/server/db/queries-security.ts'
    )
    const baselineBudgetAlerts = getAlertsByType("budget_daily_exceeded", 500)
    await triggerService.refreshNow()
    await new Promise((resolve) => setTimeout(resolve, 6000))
    const refreshedBudgetAlerts = getAlertsByType("budget_daily_exceeded", 500)
    assert.ok(
      refreshedBudgetAlerts.length > baselineBudgetAlerts.length,
      `Hermes refresh must schedule a budget check that emits a new alert (before=${baselineBudgetAlerts.length}, after=${refreshedBudgetAlerts.length})`
    )
  } finally {
    await shutdownAnalyticsService()
    await closeDatabase()
    fs.rmSync(triggerRoot, { recursive: true, force: true })
    if (configBackup !== null) {
      fs.writeFileSync(configPath, configBackup, "utf8")
    } else {
      fs.rmSync(configPath, { force: true })
    }
  }
    console.log("Hermes data pipeline checks passed")
} finally { fs.rmSync(root, { recursive: true, force: true }) }


