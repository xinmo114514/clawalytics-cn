import path from 'path'
import Database from 'better-sqlite3'
import { getConfigDir } from '../config/loader.js'

let db: Database.Database | null = null

export function getDatabase(): Database.Database {
  if (!db) {
    const dbPath = path.join(getConfigDir(), 'clawalytics.db')
    db = new Database(dbPath)
    db.pragma('journal_mode = WAL')
    initializeSchema(db)
  }
  return db
}

function initializeSchema(database: Database.Database): void {
  database.exec(`
    -- Sessions table
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      project_path TEXT NOT NULL,
      started_at TEXT NOT NULL,
      last_activity TEXT NOT NULL,
      total_input_tokens INTEGER DEFAULT 0,
      total_output_tokens INTEGER DEFAULT 0,
      total_cost REAL DEFAULT 0,
      models_used TEXT DEFAULT '[]',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    -- Requests table
    CREATE TABLE IF NOT EXISTS requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      provider TEXT NOT NULL,
      model TEXT NOT NULL,
      input_tokens INTEGER NOT NULL,
      output_tokens INTEGER NOT NULL,
      cache_creation_tokens INTEGER DEFAULT 0,
      cache_read_tokens INTEGER DEFAULT 0,
      cost REAL NOT NULL,
      message_type TEXT,
      raw_data TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (session_id) REFERENCES sessions(id)
    );

    -- Daily aggregates for faster queries
    CREATE TABLE IF NOT EXISTS daily_costs (
      date TEXT PRIMARY KEY,
      total_cost REAL DEFAULT 0,
      total_input_tokens INTEGER DEFAULT 0,
      total_output_tokens INTEGER DEFAULT 0,
      cache_creation_tokens INTEGER DEFAULT 0,
      cache_read_tokens INTEGER DEFAULT 0,
      cache_savings REAL DEFAULT 0,
      session_count INTEGER DEFAULT 0,
      request_count INTEGER DEFAULT 0
    );

    -- Model usage aggregates
    CREATE TABLE IF NOT EXISTS model_usage (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      provider TEXT NOT NULL,
      model TEXT NOT NULL,
      input_tokens INTEGER DEFAULT 0,
      output_tokens INTEGER DEFAULT 0,
      cost REAL DEFAULT 0,
      request_count INTEGER DEFAULT 0,
      UNIQUE(date, provider, model)
    );

    -- Indexes for performance
    CREATE INDEX IF NOT EXISTS idx_sessions_started_at ON sessions(started_at);
    CREATE INDEX IF NOT EXISTS idx_sessions_project_path ON sessions(project_path);
    CREATE INDEX IF NOT EXISTS idx_requests_session_id ON requests(session_id);
    CREATE INDEX IF NOT EXISTS idx_requests_timestamp ON requests(timestamp);
    CREATE INDEX IF NOT EXISTS idx_requests_provider ON requests(provider);
    CREATE INDEX IF NOT EXISTS idx_requests_model ON requests(model);
    CREATE INDEX IF NOT EXISTS idx_daily_costs_date ON daily_costs(date);
    CREATE INDEX IF NOT EXISTS idx_model_usage_date ON model_usage(date);

    -- ============================================
    -- Phase 2: Agent & Channel Tables
    -- ============================================

    -- Agents table
    CREATE TABLE IF NOT EXISTS agents (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      workspace TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      total_cost REAL DEFAULT 0,
      total_input_tokens INTEGER DEFAULT 0,
      total_output_tokens INTEGER DEFAULT 0,
      session_count INTEGER DEFAULT 0
    );

    -- Channels table
    CREATE TABLE IF NOT EXISTS channels (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      total_cost REAL DEFAULT 0,
      total_input_tokens INTEGER DEFAULT 0,
      total_output_tokens INTEGER DEFAULT 0,
      message_count INTEGER DEFAULT 0
    );

    -- Agent daily costs
    CREATE TABLE IF NOT EXISTS agent_daily_costs (
      agent_id TEXT NOT NULL,
      date TEXT NOT NULL,
      total_cost REAL DEFAULT 0,
      input_tokens INTEGER DEFAULT 0,
      output_tokens INTEGER DEFAULT 0,
      cache_read_tokens INTEGER DEFAULT 0,
      cache_creation_tokens INTEGER DEFAULT 0,
      request_count INTEGER DEFAULT 0,
      PRIMARY KEY (agent_id, date),
      FOREIGN KEY (agent_id) REFERENCES agents(id)
    );

    -- Channel daily costs
    CREATE TABLE IF NOT EXISTS channel_daily_costs (
      channel_id INTEGER NOT NULL,
      date TEXT NOT NULL,
      total_cost REAL DEFAULT 0,
      input_tokens INTEGER DEFAULT 0,
      output_tokens INTEGER DEFAULT 0,
      message_count INTEGER DEFAULT 0,
      PRIMARY KEY (channel_id, date),
      FOREIGN KEY (channel_id) REFERENCES channels(id)
    );

    -- Indexes for agents and channels
    CREATE INDEX IF NOT EXISTS idx_agents_name ON agents(name);
    CREATE INDEX IF NOT EXISTS idx_agents_workspace ON agents(workspace);
    CREATE INDEX IF NOT EXISTS idx_channels_name ON channels(name);
    CREATE INDEX IF NOT EXISTS idx_agent_daily_costs_date ON agent_daily_costs(date);
    CREATE INDEX IF NOT EXISTS idx_agent_daily_costs_agent_id ON agent_daily_costs(agent_id);
    CREATE INDEX IF NOT EXISTS idx_channel_daily_costs_date ON channel_daily_costs(date);
    CREATE INDEX IF NOT EXISTS idx_channel_daily_costs_channel_id ON channel_daily_costs(channel_id);

    -- ============================================
    -- Phase 3: Security & Device Tables
    -- ============================================

    -- Paired devices
    CREATE TABLE IF NOT EXISTS devices (
      id TEXT PRIMARY KEY,
      name TEXT,
      type TEXT,
      paired_at TEXT DEFAULT CURRENT_TIMESTAMP,
      last_seen TEXT,
      status TEXT DEFAULT 'active',
      connection_count INTEGER DEFAULT 0
    );

    -- Pairing requests history
    CREATE TABLE IF NOT EXISTS pairing_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      device_id TEXT NOT NULL,
      device_name TEXT,
      requested_at TEXT DEFAULT CURRENT_TIMESTAMP,
      responded_at TEXT,
      status TEXT DEFAULT 'pending',
      response TEXT,
      source_request_id TEXT
    );

    -- Connection events log
    CREATE TABLE IF NOT EXISTS connection_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      device_id TEXT,
      event_type TEXT NOT NULL,
      timestamp TEXT DEFAULT CURRENT_TIMESTAMP,
      ip_address TEXT,
      details TEXT
    );

    -- Outbound API/tool calls
    CREATE TABLE IF NOT EXISTS outbound_calls (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT,
      agent_id TEXT,
      tool_name TEXT NOT NULL,
      tool_use_id TEXT,
      timestamp TEXT DEFAULT CURRENT_TIMESTAMP,
      duration_ms INTEGER,
      status TEXT,
      error TEXT
    );

    -- Security alerts
    CREATE TABLE IF NOT EXISTS security_alerts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL,
      severity TEXT NOT NULL,
      message TEXT NOT NULL,
      timestamp TEXT DEFAULT CURRENT_TIMESTAMP,
      acknowledged INTEGER DEFAULT 0,
      acknowledged_at TEXT,
      details TEXT
    );

    -- Audit log
    CREATE TABLE IF NOT EXISTS audit_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      action TEXT NOT NULL,
      entity_type TEXT,
      entity_id TEXT,
      timestamp TEXT DEFAULT CURRENT_TIMESTAMP,
      actor TEXT,
      details TEXT,
      ip_address TEXT
    );

    -- Indexes for security tables
    CREATE INDEX IF NOT EXISTS idx_devices_status ON devices(status);
    CREATE INDEX IF NOT EXISTS idx_devices_last_seen ON devices(last_seen);
    CREATE INDEX IF NOT EXISTS idx_pairing_requests_device_id ON pairing_requests(device_id);
    CREATE INDEX IF NOT EXISTS idx_pairing_requests_status ON pairing_requests(status);
    CREATE INDEX IF NOT EXISTS idx_connection_events_device_id ON connection_events(device_id);
    CREATE INDEX IF NOT EXISTS idx_connection_events_timestamp ON connection_events(timestamp);
    CREATE INDEX IF NOT EXISTS idx_connection_events_event_type ON connection_events(event_type);
    CREATE INDEX IF NOT EXISTS idx_outbound_calls_session_id ON outbound_calls(session_id);
    CREATE INDEX IF NOT EXISTS idx_outbound_calls_agent_id ON outbound_calls(agent_id);
    CREATE INDEX IF NOT EXISTS idx_outbound_calls_timestamp ON outbound_calls(timestamp);
    CREATE INDEX IF NOT EXISTS idx_outbound_calls_tool_name ON outbound_calls(tool_name);
    CREATE INDEX IF NOT EXISTS idx_security_alerts_type ON security_alerts(type);
    CREATE INDEX IF NOT EXISTS idx_security_alerts_severity ON security_alerts(severity);
    CREATE INDEX IF NOT EXISTS idx_security_alerts_acknowledged ON security_alerts(acknowledged);
    CREATE INDEX IF NOT EXISTS idx_security_alerts_timestamp ON security_alerts(timestamp);
    CREATE INDEX IF NOT EXISTS idx_audit_log_action ON audit_log(action);
    CREATE INDEX IF NOT EXISTS idx_audit_log_entity_type ON audit_log(entity_type);
    CREATE INDEX IF NOT EXISTS idx_audit_log_timestamp ON audit_log(timestamp);
    CREATE INDEX IF NOT EXISTS idx_audit_log_actor ON audit_log(actor);
  `)

  // Run versioned migrations
  runMigrations(database)
}

// Each migration runs exactly once, tracked by version number in schema_version table.
// To add a new migration: append an entry to this array with the next version number.
// Migrations MUST be idempotent and non-destructive (never drop user data).
const migrations: {
  version: number
  description: string
  up: (db: Database.Database) => void
}[] = [
  {
    version: 1,
    description: 'Add cache token columns to requests and daily_costs',
    up: (db) => {
      const addColumnIfMissing = (
        table: string,
        column: string,
        type: string
      ) => {
        const info = db.prepare(`PRAGMA table_info(${table})`).all() as {
          name: string
        }[]
        if (!info.some((c) => c.name === column)) {
          db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`)
        }
      }
      addColumnIfMissing(
        'requests',
        'cache_creation_tokens',
        'INTEGER DEFAULT 0'
      )
      addColumnIfMissing('requests', 'cache_read_tokens', 'INTEGER DEFAULT 0')
      addColumnIfMissing(
        'daily_costs',
        'cache_creation_tokens',
        'INTEGER DEFAULT 0'
      )
      addColumnIfMissing(
        'daily_costs',
        'cache_read_tokens',
        'INTEGER DEFAULT 0'
      )
      addColumnIfMissing('daily_costs', 'cache_savings', 'REAL DEFAULT 0')
    },
  },
  {
    version: 2,
    description: 'Add OpenClaw integration columns to sessions',
    up: (db) => {
      const addColumnIfMissing = (
        table: string,
        column: string,
        type: string
      ) => {
        const info = db.prepare(`PRAGMA table_info(${table})`).all() as {
          name: string
        }[]
        if (!info.some((c) => c.name === column)) {
          db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`)
        }
      }
      addColumnIfMissing('sessions', 'agent_id', 'TEXT')
      addColumnIfMissing('sessions', 'channel', 'TEXT')
      addColumnIfMissing('sessions', 'origin_provider', 'TEXT')
      addColumnIfMissing(
        'sessions',
        'source_type',
        "TEXT DEFAULT 'claude-code'"
      )
      db.exec(
        'CREATE INDEX IF NOT EXISTS idx_sessions_agent_id ON sessions(agent_id)'
      )
      db.exec(
        'CREATE INDEX IF NOT EXISTS idx_sessions_channel ON sessions(channel)'
      )
      db.exec(
        'CREATE INDEX IF NOT EXISTS idx_sessions_source_type ON sessions(source_type)'
      )
    },
  },
  {
    version: 3,
    description: 'Add idempotency key for OpenClaw tool calls',
    up: (db) => {
      const info = db.prepare('PRAGMA table_info(outbound_calls)').all() as {
        name: string
      }[]
      if (!info.some((column) => column.name === 'tool_use_id')) {
        db.exec('ALTER TABLE outbound_calls ADD COLUMN tool_use_id TEXT')
      }
      db.exec(
        `CREATE UNIQUE INDEX IF NOT EXISTS idx_outbound_calls_tool_use_id
         ON outbound_calls(session_id, tool_use_id)
         WHERE tool_use_id IS NOT NULL`
      )
    },
  },
  {
    version: 4,
    description: 'Add stable OpenClaw pairing request source IDs',
    up: (db) => {
      const info = db.prepare('PRAGMA table_info(pairing_requests)').all() as {
        name: string
      }[]
      if (!info.some((column) => column.name === 'source_request_id')) {
        db.exec(
          'ALTER TABLE pairing_requests ADD COLUMN source_request_id TEXT'
        )
      }

      const duplicateDevices = db
        .prepare(
          `SELECT device_id, GROUP_CONCAT(id) AS ids
           FROM pairing_requests
           WHERE status = 'pending'
           GROUP BY device_id
           HAVING COUNT(*) > 1`
        )
        .all() as Array<{ device_id: string; ids: string }>
      for (const duplicate of duplicateDevices) {
        const ids = duplicate.ids
          .split(',')
          .map((id) => Number(id))
          .filter((id) => Number.isSafeInteger(id))
          .sort((a, b) => b - a)
        const [keep, ...older] = ids
        if (!keep) continue
        for (const id of older) {
          db.prepare(
            `UPDATE pairing_requests
             SET status = 'removed', responded_at = COALESCE(responded_at, datetime('now'))
             WHERE id = ?`
          ).run(id)
        }
        db.prepare(
          `UPDATE pairing_requests SET source_request_id = device_id
           WHERE id = ? AND source_request_id IS NULL`
        ).run(keep)
      }

      db.exec(
        `CREATE UNIQUE INDEX IF NOT EXISTS idx_pairing_requests_source_request_id
         ON pairing_requests(source_request_id)
         WHERE source_request_id IS NOT NULL`
      )
    },
  },
  {
    version: 5,
    description: 'Repair legacy pairing requests missing source_request_id',
    up: (db) => {
      const hasCanonicalSourceId = db.prepare(
        'SELECT COUNT(*) AS n FROM pairing_requests WHERE source_request_id = ?'
      )
      const bindLegacyRow = db.prepare(
        `UPDATE pairing_requests
         SET source_request_id = device_id
         WHERE id = ? AND source_request_id IS NULL AND status = 'pending'`
      )
      const markLegacyRemoved = db.prepare(
        `UPDATE pairing_requests
         SET status = 'removed',
             responded_at = COALESCE(responded_at, datetime('now'))
         WHERE id = ? AND source_request_id IS NULL AND status = 'pending'`
      )

      // Newest row first so that, per device, the most recent legacy pending
      // becomes the canonical record and any remaining duplicates are ended
      // as 'removed'. A device that already owns a canonical row (any status)
      // never gets a second binding - its legacy rows are only retired.
      const legacyRows = db
        .prepare(
          `SELECT id, device_id FROM pairing_requests
           WHERE status = 'pending' AND source_request_id IS NULL
           ORDER BY id DESC`
        )
        .all() as Array<{ id: number; device_id: string }>

      for (const row of legacyRows) {
        const canonical = hasCanonicalSourceId.get(row.device_id) as {
          n: number
        }
        if (canonical.n > 0) {
          markLegacyRemoved.run(row.id)
          continue
        }
        const bound = bindLegacyRow.run(row.id)
        if (bound.changes === 0) {
          markLegacyRemoved.run(row.id)
        }
      }
    },
  },
  // To add a future migration:
  // {
  //   version: 3,
  //   description: 'Add xyz column to sessions',
  //   up: (db) => {
  //     db.exec('ALTER TABLE sessions ADD COLUMN xyz TEXT');
  //   },
  // },
]

function runMigrations(database: Database.Database): void {
  // Create version tracking table
  database.exec(`
    CREATE TABLE IF NOT EXISTS schema_version (
      version INTEGER PRIMARY KEY,
      description TEXT NOT NULL,
      applied_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `)

  const currentVersion = (
    database
      .prepare('SELECT COALESCE(MAX(version), 0) as v FROM schema_version')
      .get() as { v: number }
  ).v

  const pending = migrations.filter((m) => m.version > currentVersion)
  if (pending.length === 0) return

  for (const migration of pending) {
    database.transaction(() => {
      migration.up(database)
      database
        .prepare(
          'INSERT INTO schema_version (version, description) VALUES (?, ?)'
        )
        .run(migration.version, migration.description)
    })()
  }
}

export function closeDatabase(): void {
  if (db) {
    db.close()
    db = null
  }
}
