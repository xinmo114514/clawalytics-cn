import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

// Point the config/cache directory at an isolated fixture before importing
// modules whose constants are initialized from os.homedir().
const home = fs.mkdtempSync(path.join(os.tmpdir(), 'clawalytics-analytics-'))
process.env.USERPROFILE = home
process.env.HOME = home

const { initializeAnalyticsService, shutdownAnalyticsService } =
  await import('../src/server/services/analytics-service.ts')

const openClawPath = path.join(home, 'openclaw')
const mainSessions = path.join(openClawPath, 'agents', 'main', 'sessions')
const otherSessions = path.join(openClawPath, 'agents', 'other', 'sessions')
fs.mkdirSync(mainSessions, { recursive: true })
fs.mkdirSync(otherSessions, { recursive: true })

try {
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
  await shutdownAnalyticsService()

  // The persisted cache must restore both sessions; a database-style
  // single-file key must never collapse distinct session entries.
  service = initializeAnalyticsService(openClawPath)
  assert.equal(service.getSessionCount(), 2)
  assert.equal(service.getEnhancedStats().totalTokens.input, 30)

  // A scoped refresh for one agent must not remove another agent's session.
  fs.appendFileSync(
    path.join(mainSessions, 'main-session.jsonl'),
    `${usage('2026-08-29T00:00:00.000Z', 5)}\n`,
    'utf8'
  )
  await service.refreshSessionFilesInBackground(
    openClawPath,
    [{ id: 'main', name: 'main' }],
    service.refreshGeneration
  )
  assert.equal(service.getSessionCount(), 2)
  assert.equal(service.getEnhancedStats().totalTokens.input, 35)
  await shutdownAnalyticsService()

  console.log('Analytics regression checks passed')
} finally {
  fs.rmSync(home, { recursive: true, force: true })
}
