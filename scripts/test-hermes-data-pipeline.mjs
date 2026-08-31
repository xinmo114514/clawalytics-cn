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
  console.log("Hermes data pipeline checks passed")
} finally { fs.rmSync(root, { recursive: true, force: true }) }


