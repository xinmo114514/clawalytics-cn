import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import Database from 'better-sqlite3'
import { loadAgents } from '../src/server/parser/openclaw/agent-loader.ts'
import {
  readOpenClawAgentDatabase,
} from '../src/server/parser/openclaw/agent-database.ts'
import { parseOpenClawLine } from '../src/server/parser/openclaw/session-parser.ts'
import {
  getSessionIdFromFileName,
  isActiveSessionTranscriptFileName,
  isSessionTranscriptFileName,
  listSessionFiles,
} from '../src/server/parser/openclaw/session-index.ts'
import { validateOpenClawDataSource } from '../src/server/parser/openclaw/data-source-validator.ts'

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'clawalytics-openclaw-'))
const agentPath = path.join(root, 'agents', 'main')
const sessionsPath = path.join(agentPath, 'sessions')
fs.mkdirSync(sessionsPath, { recursive: true })

try {
  fs.writeFileSync(
    path.join(root, 'openclaw.json'),
    `// JSON5 is the format used by OpenClaw\n{ agents: { list: [{ id: 'main', name: 'Main' }] } }`,
    'utf8'
  )
  assert.deepEqual(loadAgents(root), [
    { id: 'main', name: 'Main', workspace: undefined },
  ])

  const usage = {
    type: 'message',
    timestamp: '2026-08-28T00:00:00Z',
    message: {
      role: 'assistant',
      provider: 'qwen-portal',
      model: 'coder-model',
      usage: {
        input: 10,
        output: 2,
        cacheRead: 3,
        cacheWrite: 4,
        cost: { total: 0 },
      },
    },
  }
  const parsed = parseOpenClawLine(JSON.stringify(usage), 'session-1', 'main')
  assert.equal(parsed?.cost, 0)
  assert.deepEqual(
    [
      parsed?.inputTokens,
      parsed?.outputTokens,
      parsed?.cacheReadTokens,
      parsed?.cacheCreationTokens,
    ],
    [10, 2, 3, 4]
  )

  const numericTimestampParsed = parseOpenClawLine(
    JSON.stringify({ ...usage, timestamp: 1787875200000 }),
    'session-numeric-time',
    'main'
  )
  assert.equal(numericTimestampParsed?.timestamp, '2026-08-28T00:00:00.000Z')
  assert.equal(
    parseOpenClawLine(JSON.stringify({ ...usage, timestamp: 'invalid' }), 'bad', 'main'),
    null
  )

  const activePath = path.join(sessionsPath, 'session-1.jsonl')
  const resetPath = path.join(
    sessionsPath,
    'session-2.jsonl.reset.2026-08-28T00-00-00.000Z'
  )
  const deletedPath = path.join(
    sessionsPath,
    'session-3.jsonl.deleted.2026-08-28T00-00-00.000Z'
  )
  fs.writeFileSync(activePath, JSON.stringify(usage), 'utf8')
  fs.writeFileSync(resetPath, JSON.stringify(usage), 'utf8')
  fs.writeFileSync(deletedPath, JSON.stringify(usage), 'utf8')
  fs.writeFileSync(
    path.join(sessionsPath, 'session-1.checkpoint.abc.jsonl'),
    JSON.stringify(usage),
    'utf8'
  )
  assert.equal(listSessionFiles(agentPath).length, 3)
  assert.equal(isActiveSessionTranscriptFileName('session-1.jsonl'), true)
  assert.equal(
    isActiveSessionTranscriptFileName('session-1.checkpoint.abc.jsonl'),
    false
  )
  assert.equal(isSessionTranscriptFileName(path.basename(resetPath)), true)
  assert.equal(getSessionIdFromFileName(path.basename(resetPath)), 'session-2')

  const databasePath = path.join(agentPath, 'agent', 'openclaw-agent.sqlite')
  fs.mkdirSync(path.dirname(databasePath), { recursive: true })
  const database = new Database(databasePath)
  database.exec(`
    CREATE TABLE session_windows (
      session_id TEXT PRIMARY KEY,
      channel TEXT,
      started_at INTEGER,
      created_at INTEGER,
      updated_at INTEGER
    );
    CREATE TABLE session_nodes (
      current_session_id TEXT,
      last_interaction_at INTEGER
    );
    CREATE TABLE transcript_events (
      session_id TEXT,
      seq INTEGER,
      event_json TEXT
    );
  `)
  database
    .prepare('INSERT INTO session_windows VALUES (?, ?, ?, ?, ?)')
    .run('session-1', 'telegram', 1787875200000, 1787875200000, 1787875200000)
  database
    .prepare('INSERT INTO session_nodes VALUES (?, ?)')
    .run('session-1', 1787875200000)
  database
    .prepare('INSERT INTO transcript_events VALUES (?, ?, ?)')
    .run('session-1', 0, Buffer.from(JSON.stringify(usage)))
  database.close()

  const databaseResult = readOpenClawAgentDatabase(agentPath, 'main')
  assert.equal(databaseResult.warning, undefined)
  assert.equal(databaseResult.sessions.length, 1)
  assert.equal(databaseResult.sessions[0].requests.length, 1)
  assert.equal(databaseResult.sessions[0].requests[0].cost, 0)

  const validation = validateOpenClawDataSource(root)
  assert.equal(validation.databaseSessionsFound, 1)
  assert.equal(validation.parsedUsageEntries, 3)
  assert.equal(validation.sampledLines, 2)

  console.log('OpenClaw data pipeline checks passed')
} finally {
  fs.rmSync(root, { recursive: true, force: true })
}
