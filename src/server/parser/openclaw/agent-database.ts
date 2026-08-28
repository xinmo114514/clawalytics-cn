import path from 'path'
import Database from 'better-sqlite3'
import fs from 'fs'
import {
  parseOpenClawLine,
  type ParsedOpenClawResult,
} from './session-parser.js'

export interface OpenClawDatabaseSession {
  id: string
  channel?: string
  createdAt?: string
  startedAt?: string
  lastActivity?: string
  requests: ParsedOpenClawResult[]
}

export interface OpenClawDatabaseReadResult {
  databasePath: string
  available: boolean
  sessions: OpenClawDatabaseSession[]
  warning?: string
}

export function getOpenClawAgentDatabasePath(agentPath: string): string {
  return path.join(agentPath, 'agent', 'openclaw-agent.sqlite')
}

function tableExists(database: Database.Database, tableName: string): boolean {
  return Boolean(
    database
      .prepare(
        "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ? LIMIT 1"
      )
      .get(tableName)
  )
}

function tableColumns(
  database: Database.Database,
  tableName: string
): Set<string> {
  try {
    return new Set(
      (
        database.prepare(`PRAGMA table_info(${tableName})`).all() as Array<{
          name?: unknown
        }>
      )
        .map((column) => column.name)
        .filter((name): name is string => typeof name === 'string')
    )
  } catch {
    return new Set()
  }
}

function epochToIso(value: unknown): string | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return undefined
  }

  // OpenClaw stores epoch timestamps in milliseconds. Accept seconds too so
  // older or migrated databases do not get dated in the year 51382.
  const milliseconds = value < 1_000_000_000_000 ? value * 1000 : value
  const date = new Date(milliseconds)
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString()
}

function eventJsonToLine(value: unknown): string | null {
  if (typeof value === 'string') {
    return value
  }
  if (Buffer.isBuffer(value)) {
    return value.toString('utf8')
  }
  return null
}

/**
 * Read the current OpenClaw per-agent SQLite store without mutating it.
 * Newer OpenClaw releases keep canonical transcripts here; legacy JSONL is
 * still handled separately for older installations and archived artifacts.
 */
export function readOpenClawAgentDatabase(
  agentPath: string,
  agentId: string
): OpenClawDatabaseReadResult {
  const databasePath = getOpenClawAgentDatabasePath(agentPath)
  if (!fs.existsSync(databasePath)) {
    return { databasePath, available: false, sessions: [] }
  }

  let database: Database.Database | null = null
  try {
    database = new Database(databasePath, {
      readonly: true,
      fileMustExist: true,
      timeout: 2000,
    })

    if (!tableExists(database, 'transcript_events')) {
      return {
        databasePath,
        available: true,
        sessions: [],
        warning: 'OpenClaw agent database has no transcript_events table.',
      }
    }

    const sessions = new Map<string, OpenClawDatabaseSession>()

    if (tableExists(database, 'session_windows')) {
      const hasSessionNodes = tableExists(database, 'session_nodes')
      const sessionWindowColumns = tableColumns(database, 'session_windows')
      const sessionNodeColumns = hasSessionNodes
        ? tableColumns(database, 'session_nodes')
        : new Set<string>()
      const createdAtExpression = sessionWindowColumns.has('created_at')
        ? 'sw.created_at'
        : 'NULL'
      const lastActivityExpression =
        hasSessionNodes && sessionNodeColumns.has('last_interaction_at')
          ? '(SELECT MAX(sn.last_interaction_at) FROM session_nodes AS sn WHERE sn.current_session_id = sw.session_id)'
          : sessionWindowColumns.has('updated_at')
            ? 'sw.updated_at'
            : 'NULL'
      const rows = database
        .prepare(
          `
            SELECT
              sw.session_id AS session_id,
              sw.channel AS channel,
              sw.started_at AS started_at,
              ${createdAtExpression} AS created_at,
              ${lastActivityExpression} AS last_activity
            FROM session_windows AS sw
          `
        )
        .all() as Array<Record<string, unknown>>

      for (const row of rows) {
        if (typeof row.session_id !== 'string' || !row.session_id) continue
        sessions.set(row.session_id, {
          id: row.session_id,
          channel: typeof row.channel === 'string' ? row.channel : undefined,
          createdAt: epochToIso(row.created_at),
          startedAt: epochToIso(row.started_at),
          lastActivity: epochToIso(row.last_activity),
          requests: [],
        })
      }
    } else if (tableExists(database, 'sessions')) {
      // Compatibility with the short-lived pre-session_windows schema.
      const sessionColumns = tableColumns(database, 'sessions')
      const channelExpression = sessionColumns.has('channel')
        ? 'channel'
        : 'NULL'
      const createdAtExpression = sessionColumns.has('created_at')
        ? 'created_at'
        : 'NULL'
      const startedAtExpression = sessionColumns.has('started_at')
        ? 'started_at'
        : 'NULL'
      const updatedAtExpression = sessionColumns.has('updated_at')
        ? 'updated_at'
        : 'NULL'
      const rows = database
        .prepare(
          `SELECT
             session_id,
             ${channelExpression} AS channel,
             ${startedAtExpression} AS started_at,
             ${createdAtExpression} AS created_at,
             ${updatedAtExpression} AS updated_at
           FROM sessions`
        )
        .all() as Array<Record<string, unknown>>
      for (const row of rows) {
        if (typeof row.session_id !== 'string' || !row.session_id) continue
        sessions.set(row.session_id, {
          id: row.session_id,
          channel: typeof row.channel === 'string' ? row.channel : undefined,
          createdAt: epochToIso(row.created_at),
          startedAt: epochToIso(row.started_at),
          lastActivity: epochToIso(row.updated_at),
          requests: [],
        })
      }
    }

    const events = database
      .prepare(
        'SELECT session_id, event_json FROM transcript_events ORDER BY session_id, seq'
      )
      .all() as Array<{ session_id?: unknown; event_json?: unknown }>

    for (const event of events) {
      if (typeof event.session_id !== 'string' || !event.session_id) {
        continue
      }

      let session = sessions.get(event.session_id)
      if (!session) {
        session = { id: event.session_id, requests: [] }
        sessions.set(event.session_id, session)
      }

      const line = eventJsonToLine(event.event_json)
      if (!line) continue

      const parsed = parseOpenClawLine(line, event.session_id, agentId)
      if (parsed) {
        session.requests.push(parsed)
        if (!session.startedAt || parsed.timestamp < session.startedAt) {
          session.startedAt = parsed.timestamp
        }
        if (!session.lastActivity || parsed.timestamp > session.lastActivity) {
          session.lastActivity = parsed.timestamp
        }
      }
    }

    return {
      databasePath,
      available: true,
      sessions: [...sessions.values()],
    }
  } catch (error) {
    return {
      databasePath,
      available: true,
      sessions: [],
      warning: `Unable to read OpenClaw agent database: ${
        error instanceof Error ? error.message : String(error)
      }`,
    }
  } finally {
    database?.close()
  }
}
