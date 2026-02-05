import Database from 'better-sqlite3';
import path from 'path';
import { getConfigDir } from '../config/loader.js';

let db: Database.Database | null = null;

export function getDatabase(): Database.Database {
  if (!db) {
    const dbPath = path.join(getConfigDir(), 'clawalytics.db');
    db = new Database(dbPath);
    db.pragma('journal_mode = WAL');
    initializeSchema(db);
  }
  return db;
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
      response TEXT
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
  `);

  // Run migrations to add new columns to existing databases
  runMigrations(database);
}

function runMigrations(database: Database.Database): void {
  // Check if cache columns exist in requests table
  const requestsInfo = database.prepare("PRAGMA table_info(requests)").all() as { name: string }[];
  const requestsColumns = requestsInfo.map(c => c.name);

  if (!requestsColumns.includes('cache_creation_tokens')) {
    database.exec('ALTER TABLE requests ADD COLUMN cache_creation_tokens INTEGER DEFAULT 0');
  }
  if (!requestsColumns.includes('cache_read_tokens')) {
    database.exec('ALTER TABLE requests ADD COLUMN cache_read_tokens INTEGER DEFAULT 0');
  }

  // Check if cache columns exist in daily_costs table
  const dailyCostsInfo = database.prepare("PRAGMA table_info(daily_costs)").all() as { name: string }[];
  const dailyCostsColumns = dailyCostsInfo.map(c => c.name);

  if (!dailyCostsColumns.includes('cache_creation_tokens')) {
    database.exec('ALTER TABLE daily_costs ADD COLUMN cache_creation_tokens INTEGER DEFAULT 0');
  }
  if (!dailyCostsColumns.includes('cache_read_tokens')) {
    database.exec('ALTER TABLE daily_costs ADD COLUMN cache_read_tokens INTEGER DEFAULT 0');
  }
  if (!dailyCostsColumns.includes('cache_savings')) {
    database.exec('ALTER TABLE daily_costs ADD COLUMN cache_savings REAL DEFAULT 0');
  }

  // Phase 2 & 3: Add new columns to sessions table for OpenClaw integration
  const sessionsInfo = database.prepare("PRAGMA table_info(sessions)").all() as { name: string }[];
  const sessionsColumns = sessionsInfo.map(c => c.name);

  if (!sessionsColumns.includes('agent_id')) {
    database.exec('ALTER TABLE sessions ADD COLUMN agent_id TEXT');
  }
  if (!sessionsColumns.includes('channel')) {
    database.exec('ALTER TABLE sessions ADD COLUMN channel TEXT');
  }
  if (!sessionsColumns.includes('origin_provider')) {
    database.exec('ALTER TABLE sessions ADD COLUMN origin_provider TEXT');
  }
  if (!sessionsColumns.includes('source_type')) {
    database.exec("ALTER TABLE sessions ADD COLUMN source_type TEXT DEFAULT 'claude-code'");
  }

  // Add indexes for new sessions columns (conditional - only if sessions table has new columns)
  if (!sessionsColumns.includes('agent_id')) {
    // Index will be created on new databases via schema, but for migrated databases:
    try {
      database.exec('CREATE INDEX IF NOT EXISTS idx_sessions_agent_id ON sessions(agent_id)');
      database.exec('CREATE INDEX IF NOT EXISTS idx_sessions_channel ON sessions(channel)');
      database.exec('CREATE INDEX IF NOT EXISTS idx_sessions_source_type ON sessions(source_type)');
    } catch {
      // Indexes may already exist
    }
  }
}

export function closeDatabase(): void {
  if (db) {
    db.close();
    db = null;
  }
}
