import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import Database from 'better-sqlite3'

// Point the config/cache directory at an isolated fixture before importing
// modules whose constants are initialized from os.homedir().
const home = fs.mkdtempSync(path.join(os.tmpdir(), 'clawalytics-analytics-'))
process.env.USERPROFILE = home
process.env.HOME = home

const { initializeAnalyticsService, shutdownAnalyticsService } =
  await import('../src/server/services/analytics-service.ts')
const { deriveAnalyticsViewState } =
  await import('../src/client/features/dashboard/analytics-view-state.ts')
const { getOutboundCallsBySession } =
  await import('../src/server/db/queries-security.ts')
const { closeDatabase } = await import('../src/server/db/schema.ts')
const { buildAnalyticsIndex, localWeekStart, localWindowStart } =
  await import('../src/server/analytics/analytics-index.ts')
const { createPricingFingerprint, getPricingFingerprint } =
  await import('../src/server/services/pricing-service.ts')

const openClawPath = path.join(home, 'openclaw')
const mainSessions = path.join(openClawPath, 'agents', 'main', 'sessions')
const otherSessions = path.join(openClawPath, 'agents', 'other', 'sessions')
fs.mkdirSync(mainSessions, { recursive: true })
fs.mkdirSync(otherSessions, { recursive: true })

try {
  const fixedNow = new Date(2026, 7, 31, 12, 0, 0)
  assert.equal(localWeekStart(fixedNow), '2026-08-31')
  assert.equal(localWindowStart(fixedNow, 7), '2026-08-25')
  assert.equal(getPricingFingerprint(), getPricingFingerprint())
  assert.equal(
    createPricingFingerprint({
      b: { input: 2, output: 3 },
      a: { input: 1, output: 2 },
    }),
    createPricingFingerprint({
      a: { input: 1, output: 2 },
      b: { input: 2, output: 3 },
    })
  )
  assert.notEqual(
    createPricingFingerprint({ a: { input: 1, output: 2 } }),
    createPricingFingerprint({ a: { input: 1, output: 3 } })
  )

  const indexed = buildAnalyticsIndex(
    new Map([
      [
        'date-session',
        {
          id: 'date-session',
          agentId: 'main',
          projectPath: 'fixture',
          startedAt: fixedNow.toISOString(),
          lastActivity: fixedNow.toISOString(),
          requests: [
            {
              timestamp: fixedNow.toISOString(),
              provider: 'test',
              model: 'today',
              inputTokens: 2,
              outputTokens: 1,
              cacheCreationTokens: 0,
              cacheReadTokens: 0,
              cost: 3,
              cacheSavings: 0,
              messageType: 'assistant',
            },
            {
              timestamp: new Date(2026, 8, 1, 12, 0, 0).toISOString(),
              provider: 'test',
              model: 'future',
              inputTokens: 100,
              outputTokens: 0,
              cacheCreationTokens: 0,
              cacheReadTokens: 0,
              cost: 100,
              cacheSavings: 0,
              messageType: 'assistant',
            },
          ],
          totalCost: 103,
          totalInputTokens: 102,
          totalOutputTokens: 1,
          modelsUsed: new Set(['today', 'future']),
          toolCalls: [],
        },
      ],
    ]),
    fixedNow
  )
  assert.equal(indexed.stats.totalCost, 3)
  assert.equal(indexed.stats.weekSpend, 3)

  fs.writeFileSync(
    path.join(openClawPath, 'openclaw.json'),
    "{ agents: { list: [{ id: 'main' }, { id: 'other' }] } }",
    'utf8'
  )
  const usage = (timestamp, input) =>
    JSON.stringify({
      type: 'message',
      timestamp,
      message: {
        role: 'assistant',
        provider: 'qwen-portal',
        model: 'coder-model',
        usage: { input, output: 1, cacheRead: 0, cacheWrite: 0 },
      },
    })

  fs.writeFileSync(
    path.join(mainSessions, 'main-session.jsonl'),
    `${usage('2026-08-28T00:00:00.000Z', 10)}\n`,
    'utf8'
  )
  fs.writeFileSync(
    path.join(otherSessions, 'other-session.jsonl'),
    `${usage('2026-08-28T00:00:00.000Z', 20)}\n`,
    'utf8'
  )

  let service = initializeAnalyticsService(openClawPath)
  await service.refreshNow()
  assert.equal(service.getSessionCount(), 2)
  assert.equal(service.getEnhancedStats().totalTokens.input, 30)
  assert.equal(service.getStatus().snapshotState, 'verified')
  assert.ok(service.getStatus().lastSuccessfulScanAt)
  await shutdownAnalyticsService()

  // The persisted cache must restore both sessions; a database-style
  // single-file key must never collapse distinct session entries.
  service = initializeAnalyticsService(openClawPath)
  assert.equal(service.getSessionCount(), 2)
  assert.equal(service.getEnhancedStats().totalTokens.input, 30)
  assert.equal(service.getStatus().snapshotState, 'cached')

  // A scoped refresh for one agent must not remove another agent's session.
  fs.appendFileSync(
    path.join(mainSessions, 'main-session.jsonl'),
    `${usage('2026-08-29T00:00:00.000Z', 5)}\n`,
    'utf8'
  )
  const originalParseSessionFile = service.parseSessionFile.bind(service)
  let releaseParse
  let markParseStarted
  const parseStarted = new Promise((resolve) => {
    markParseStarted = resolve
  })
  const parseReleased = new Promise((resolve) => {
    releaseParse = resolve
  })
  service.parseSessionFile = async (...args) => {
    markParseStarted()
    await parseReleased
    return originalParseSessionFile(...args)
  }

  const atomicRefresh = service.refreshSessionFilesInBackground(
    openClawPath,
    [{ id: 'main', name: 'main' }],
    service.refreshGeneration
  )
  await parseStarted

  // Queries outside the scan context must continue to see the last complete
  // snapshot until the working copy is committed.
  assert.equal(service.getEnhancedStats().totalTokens.input, 30)
  releaseParse()
  await atomicRefresh
  service.parseSessionFile = originalParseSessionFile
  assert.equal(service.getSessionCount(), 2)
  assert.equal(service.getEnhancedStats().totalTokens.input, 35)
  assert.equal(service.getStatus().snapshotState, 'verified')

  // A failed refresh must retain the last complete snapshot and mark it stale.
  const originalDatabaseLoad = service.loadAgentDatabaseSessions.bind(service)
  const originalConsoleError = console.error
  const originalConsoleWarn = console.warn
  service.loadAgentDatabaseSessions = async () => {
    throw new Error('injected scan failure')
  }
  console.error = () => {}
  await service.refreshSessionFilesInBackground(
    openClawPath,
    [{ id: 'main', name: 'main' }],
    service.refreshGeneration
  )
  console.error = originalConsoleError
  service.loadAgentDatabaseSessions = originalDatabaseLoad
  assert.equal(service.getEnhancedStats().totalTokens.input, 35)
  assert.equal(service.getStatus().status, 'error')
  assert.equal(service.getStatus().snapshotState, 'stale')

  await service.refreshSessionFilesInBackground(
    openClawPath,
    [{ id: 'main', name: 'main' }],
    service.refreshGeneration
  )
  assert.equal(service.getStatus().snapshotState, 'verified')

  assert.deepEqual(deriveAnalyticsViewState(service.getStatus(), false, false), {
    canQuery: true,
    showSkeleton: false,
    showUnavailable: false,
    isRefreshing: false,
    isCached: false,
    isStale: false,
  })
  assert.equal(
    deriveAnalyticsViewState(
      {
        ...service.getStatus(),
        status: 'error',
        snapshotState: 'stale',
      },
      false,
      false
    ).canQuery,
    true
  )
  assert.equal(
    deriveAnalyticsViewState(
      {
        ...service.getStatus(),
        status: 'scanning',
        hasData: false,
        snapshotState: 'none',
      },
      false,
      false
    ).showSkeleton,
    true
  )

  // A failed atomic rename must remain retryable with the same payload.
  await service.flushSessionCache()
  const originalRename = fs.promises.rename
  let renameAttempts = 0
  service.lastCachePayload = null
  console.warn = () => {}
  fs.promises.rename = async (...args) => {
    renameAttempts++
    if (renameAttempts === 1) {
      throw new Error('injected cache rename failure')
    }
    return originalRename(...args)
  }
  await service.saveSessionCacheNow()
  assert.equal(service.lastCachePayload, null)
  await service.saveSessionCacheNow()
  console.warn = originalConsoleWarn
  fs.promises.rename = originalRename
  assert.equal(renameAttempts, 2)
  assert.equal(typeof service.lastCachePayload, 'string')
  await shutdownAnalyticsService()

  // SQLite checkpoints must detect a rebuilt session even when max(seq) did
  // not move, and tool-call extraction must match the JSONL path.
  const dbOpenClawPath = path.join(home, 'openclaw-db')
  const dbAgentPath = path.join(dbOpenClawPath, 'agents', 'db-agent')
  const dbPath = path.join(dbAgentPath, 'agent', 'openclaw-agent.sqlite')
  fs.mkdirSync(path.dirname(dbPath), { recursive: true })
  fs.mkdirSync(path.join(dbAgentPath, 'sessions'), { recursive: true })
  fs.writeFileSync(
    path.join(dbOpenClawPath, 'openclaw.json'),
    "{ agents: { list: [{ id: 'db-agent' }] } }",
    'utf8'
  )
  let sourceDb = new Database(dbPath)
  sourceDb.exec(`
    CREATE TABLE session_windows (
      session_id TEXT PRIMARY KEY,
      channel TEXT,
      started_at INTEGER,
      created_at INTEGER,
      updated_at INTEGER
    );
    CREATE TABLE transcript_events (
      session_id TEXT,
      seq INTEGER,
      event_json TEXT,
      PRIMARY KEY (session_id, seq)
    );
  `)
  for (const sessionId of ['replace-session', 'tool-session']) {
    sourceDb
      .prepare('INSERT INTO session_windows VALUES (?, ?, ?, ?, ?)')
      .run(sessionId, 'local', 1787875200000, 1787875200000, 1787875200000)
  }
  sourceDb
    .prepare('INSERT INTO transcript_events VALUES (?, ?, ?)')
    .run('replace-session', 1, usage('2026-08-28T00:00:00.000Z', 10))
  sourceDb
    .prepare('INSERT INTO transcript_events VALUES (?, ?, ?)')
    .run(
      'tool-session',
      1,
      JSON.stringify({
        type: 'message',
        timestamp: '2026-08-28T00:00:00.000Z',
        message: {
          role: 'assistant',
          content: [{ type: 'tool_use', id: 'tool-1', name: 'exec' }],
        },
      })
    )
  sourceDb
    .prepare('INSERT INTO transcript_events VALUES (?, ?, ?)')
    .run(
      'tool-session',
      2,
      JSON.stringify({
        type: 'message',
        timestamp: '2026-08-28T00:00:01.000Z',
        message: {
          role: 'user',
          content: [
            { type: 'tool_result', tool_use_id: 'tool-1', content: 'ok' },
          ],
        },
      })
    )
  sourceDb.close()

  let dbService = initializeAnalyticsService(dbOpenClawPath)
  await dbService.refreshNow()
  assert.equal(dbService.getEnhancedStats().totalTokens.input, 10)
  assert.equal(getOutboundCallsBySession('tool-session').length, 1)
  await shutdownAnalyticsService()

  sourceDb = new Database(dbPath)
  sourceDb
    .prepare(
      'UPDATE transcript_events SET event_json = ? WHERE session_id = ? AND seq = ?'
    )
    .run(
      usage('2026-08-28T00:00:00.000Z', 99),
      'replace-session',
      1
    )
  sourceDb.close()

  dbService = initializeAnalyticsService(dbOpenClawPath)
  assert.equal(dbService.getEnhancedStats().totalTokens.input, 10)
  await dbService.refreshNow()
  assert.equal(dbService.getEnhancedStats().totalTokens.input, 99)
  assert.equal(getOutboundCallsBySession('tool-session').length, 1)
  await shutdownAnalyticsService()

  console.log('Analytics regression checks passed')
} finally {
  closeDatabase()
  fs.rmSync(home, { recursive: true, force: true })
}
