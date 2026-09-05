import type Database from 'better-sqlite3'
import { getDatabase } from './schema.js'

// ============================================
// Prepared statement cache
// ============================================
//
// Every query in this module used to call db.prepare() on each invocation.
// better-sqlite3 compiles SQL synchronously, so hot paths (tool-call logging
// during parsing, security dashboards polled every few seconds) paid that
// cost repeatedly. Statements are cached per database instance - the WeakMap
// invalidates automatically if the module-level singleton is ever reopened.

const statementCache = new WeakMap<
  Database.Database,
  Map<string, Database.Statement>
>()

function prepareCached(sql: string): Database.Statement {
  const db = getDatabase()
  let cache = statementCache.get(db)
  if (!cache) {
    cache = new Map()
    statementCache.set(db, cache)
  }
  let statement = cache.get(sql)
  if (!statement) {
    statement = db.prepare(sql)
    cache.set(sql, statement)
  }
  return statement
}

// ============================================
// Device Interfaces
// ============================================

export interface Device {
  id: string
  name: string | null
  type: string | null
  paired_at: string
  last_seen: string | null
  status: string
  connection_count: number
}

export interface DeviceInput {
  id: string
  name?: string | null
  type?: string | null
  paired_at?: string
  status?: string
}

// ============================================
// Pairing Request Interfaces
// ============================================

export interface PairingRequest {
  id: number
  device_id: string
  device_name: string | null
  requested_at: string
  responded_at: string | null
  status: string
  response: string | null
  source_request_id: string | null
}

export interface PairingRequestInput {
  device_id: string
  device_name?: string | null
  status?: string
  source_request_id?: string | null
}

// ============================================
// Connection Event Interfaces
// ============================================

export interface ConnectionEvent {
  id: number
  device_id: string | null
  event_type: string
  timestamp: string
  ip_address: string | null
  details: string | null
}

export interface ConnectionEventInput {
  device_id?: string | null
  event_type: string
  ip_address?: string | null
  details?: string | null
}

// ============================================
// Outbound Call Interfaces
// ============================================

export interface OutboundCall {
  id: number
  session_id: string | null
  agent_id: string | null
  tool_name: string
  tool_use_id: string | null
  timestamp: string
  duration_ms: number | null
  status: string | null
  error: string | null
}

export interface OutboundCallInput {
  session_id?: string | null
  agent_id?: string | null
  tool_name: string
  tool_use_id?: string | null
  duration_ms?: number | null
  status?: string | null
  error?: string | null
}

// ============================================
// Security Alert Interfaces
// ============================================

export interface SecurityAlert {
  id: number
  type: string
  severity: string
  message: string
  timestamp: string
  acknowledged: number
  acknowledged_at: string | null
  details: string | null
}

export interface AlertInput {
  type: string
  severity: string
  message: string
  details?: string | null
}

// ============================================
// Audit Log Interfaces
// ============================================

export interface AuditEntry {
  id: number
  action: string
  entity_type: string | null
  entity_id: string | null
  timestamp: string
  actor: string | null
  details: string | null
  ip_address: string | null
}

export interface AuditInput {
  action: string
  entity_type?: string | null
  entity_id?: string | null
  actor?: string | null
  details?: string | null
  ip_address?: string | null
}

export interface AuditFilters {
  action?: string
  entity_type?: string
  entity_id?: string
  actor?: string
  ip_address?: string
  startDate?: string
  endDate?: string
  limit?: number
  offset?: number
}

// ============================================
// Device Queries
// ============================================

export function upsertDevice(device: DeviceInput): void {
  const stmt = prepareCached(`
    INSERT INTO devices (id, name, type, status)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      name = COALESCE(excluded.name, devices.name),
      type = COALESCE(excluded.type, devices.type),
      status = COALESCE(excluded.status, devices.status)
  `)
  stmt.run(
    device.id,
    device.name ?? null,
    device.type ?? null,
    device.status ?? 'active'
  )
}

export function getDevices(): Device[] {
  return prepareCached(
    `
    SELECT * FROM devices
    ORDER BY last_seen DESC NULLS LAST, paired_at DESC
  `
  ).all() as Device[]
}

export function getDevice(id: string): Device | undefined {
  return prepareCached('SELECT * FROM devices WHERE id = ?').get(id) as
    | Device
    | undefined
}

export function getActiveDevices(): Device[] {
  return prepareCached(
    `
    SELECT * FROM devices
    WHERE status = 'active'
    ORDER BY last_seen DESC NULLS LAST
  `
  ).all() as Device[]
}

export function updateDeviceLastSeen(id: string): void {
  const stmt = prepareCached(`
    UPDATE devices SET
      last_seen = datetime('now'),
      connection_count = connection_count + 1
    WHERE id = ?
  `)
  stmt.run(id)
}

export function updateDeviceStatus(id: string, status: string): void {
  prepareCached('UPDATE devices SET status = ? WHERE id = ?').run(status, id)
}

export function deleteDevice(id: string): void {
  prepareCached('DELETE FROM devices WHERE id = ?').run(id)
}

// ============================================
// Pairing Request Queries
// ============================================

export function createPairingRequest(request: PairingRequestInput): number {
  if (request.source_request_id) {
    const existing = prepareCached(
      'SELECT id FROM pairing_requests WHERE source_request_id = ?'
    ).get(request.source_request_id) as { id: number } | undefined
    if (existing) {
      prepareCached(
        `UPDATE pairing_requests SET
           device_id = ?, device_name = ?, status = ?,
           responded_at = NULL, response = NULL
         WHERE id = ?`
      ).run(
        request.device_id,
        request.device_name ?? null,
        request.status ?? 'pending',
        existing.id
      )
      return existing.id
    }
    const result = prepareCached(`
      INSERT INTO pairing_requests (device_id, device_name, status, source_request_id)
      VALUES (?, ?, ?, ?)
    `).run(
      request.device_id,
      request.device_name ?? null,
      request.status ?? 'pending',
      request.source_request_id
    )
    return result.lastInsertRowid as number
  }

  const stmt = prepareCached(`
    INSERT INTO pairing_requests (device_id, device_name)
    VALUES (?, ?)
  `)
  const result = stmt.run(request.device_id, request.device_name ?? null)
  return result.lastInsertRowid as number
}

// ============================================
// Snapshot reconciliation
// ============================================
//
// The OpenClaw pairing files (paired.json / pending.json) are the authority
// on device and request state. Reconciliation runs inside a single
// transaction whenever both snapshots are valid and returns the real state
// changes it applied, so callers can audit/alert exactly once per change and
// never for unchanged data.

export interface SecurityPairedEntry {
  id: string
  name: string | null
  type: string | null
}

export interface SecurityPendingEntry {
  id: string
  deviceName: string | null
  type: string | null
  requestedAt: string | null
}

export interface SecurityStateChange {
  kind: 'device' | 'pairing_request'
  id: string
  from: string | null
  to: string
}

export function reconcileSecurityState(
  pairedDevices: SecurityPairedEntry[],
  pendingRequests: SecurityPendingEntry[]
): SecurityStateChange[] {
  const changes: SecurityStateChange[] = []
  const pairedIds = new Set(pairedDevices.map((device) => device.id))
  const pendingIds = new Set(pendingRequests.map((request) => request.id))

  const insertDevice = prepareCached(
    `INSERT INTO devices (id, name, type, status)
     VALUES (?, ?, ?, 'active')
     ON CONFLICT(id) DO UPDATE SET
       name = COALESCE(excluded.name, devices.name),
       type = COALESCE(excluded.type, devices.type)`
  )
  const setDeviceStatus = prepareCached(
    'UPDATE devices SET status = ? WHERE id = ?'
  )

  const loadRequests = prepareCached(
    `SELECT id, device_id, source_request_id, status
     FROM pairing_requests
     WHERE status IN ('pending', 'resolved', 'removed')`
  )
  const setRequestStatus = prepareCached(
    `UPDATE pairing_requests
     SET status = ?, responded_at = COALESCE(responded_at, datetime('now'))
     WHERE source_request_id = ?`
  )
  const insertRequest = prepareCached(
    `INSERT INTO pairing_requests
       (device_id, device_name, status, source_request_id, requested_at)
     VALUES (?, ?, ?, ?, COALESCE(?, datetime('now')))`
  )

  getDatabase().transaction(() => {
    // Devices: the paired snapshot defines the active set.
    const deviceRows = prepareCached(
      'SELECT id, status FROM devices'
    ).all() as Array<{ id: string; status: string }>
    const deviceRowsById = new Map(deviceRows.map((row) => [row.id, row]))

    for (const device of pairedDevices) {
      const existing = deviceRowsById.get(device.id)
      if (!existing) {
        insertDevice.run(device.id, device.name, device.type)
        changes.push({
          kind: 'device',
          id: device.id,
          from: null,
          to: 'active',
        })
      } else {
        if (existing.status !== 'active') {
          setDeviceStatus.run('active', device.id)
          changes.push({
            kind: 'device',
            id: device.id,
            from: existing.status,
            to: 'active',
          })
        }
      }
    }

    for (const row of deviceRows) {
      if (row.status === 'active' && !pairedIds.has(row.id)) {
        setDeviceStatus.run('removed', row.id)
        changes.push({
          kind: 'device',
          id: row.id,
          from: 'active',
          to: 'removed',
        })
      }
    }

    // Pairing requests: paired membership resolves (priority over pending),
    // pending.json keeps requests pending, requests that vanished from
    // pending without being paired are removed. Removed requests may be
    // corrected back to resolved (out-of-order file writes); resolved
    // history is never downgraded.
    const requestRows = loadRequests.all() as Array<{
      id: number
      device_id: string
      source_request_id: string | null
      status: string
    }>
    const knownSourceIds = new Set<string>()
    for (const row of requestRows) {
      if (!row.source_request_id) continue
      knownSourceIds.add(row.source_request_id)

      const isPaired =
        pairedIds.has(row.source_request_id) || pairedIds.has(row.device_id)
      let desired: string | null = null
      if (isPaired) {
        desired = 'resolved'
      } else if (pendingIds.has(row.source_request_id)) {
        desired = 'pending'
      } else if (row.status === 'pending') {
        desired = 'removed'
      }

      if (!desired || desired === row.status) continue
      setRequestStatus.run(desired, row.source_request_id)
      changes.push({
        kind: 'pairing_request',
        id: row.source_request_id,
        from: row.status,
        to: desired,
      })
    }

    for (const request of pendingRequests) {
      if (knownSourceIds.has(request.id)) continue
      const status = pairedIds.has(request.id) ? 'resolved' : 'pending'
      insertRequest.run(
        request.id,
        request.deviceName,
        status,
        request.id,
        request.requestedAt
      )
      changes.push({
        kind: 'pairing_request',
        id: request.id,
        from: null,
        to: status,
      })
    }
  })()

  return changes
}

export function getPendingRequests(): PairingRequest[] {
  return prepareCached(
    `
    SELECT * FROM pairing_requests
    WHERE status = 'pending'
    ORDER BY requested_at DESC
  `
  ).all() as PairingRequest[]
}

export function getPairingRequests(limit = 100): PairingRequest[] {
  return prepareCached(
    `
    SELECT * FROM pairing_requests
    ORDER BY requested_at DESC
    LIMIT ?
  `
  ).all(limit) as PairingRequest[]
}

export function getPairingRequest(id: number): PairingRequest | undefined {
  return prepareCached('SELECT * FROM pairing_requests WHERE id = ?').get(
    id
  ) as PairingRequest | undefined
}

// ============================================
// Connection Event Queries
// ============================================

export function logConnectionEvent(event: ConnectionEventInput): number {
  const stmt = prepareCached(`
    INSERT INTO connection_events (device_id, event_type, ip_address, details)
    VALUES (?, ?, ?, ?)
  `)
  const result = stmt.run(
    event.device_id ?? null,
    event.event_type,
    event.ip_address ?? null,
    event.details ?? null
  )
  return result.lastInsertRowid as number
}

export function getConnectionEvents(
  limit = 100,
  deviceId?: string
): ConnectionEvent[] {
  if (deviceId) {
    return prepareCached(
      `
      SELECT * FROM connection_events
      WHERE device_id = ?
      ORDER BY timestamp DESC
      LIMIT ?
    `
    ).all(deviceId, limit) as ConnectionEvent[]
  }

  return prepareCached(
    `
    SELECT * FROM connection_events
    ORDER BY timestamp DESC
    LIMIT ?
  `
  ).all(limit) as ConnectionEvent[]
}

export function getConnectionEventsByType(
  eventType: string,
  limit = 100
): ConnectionEvent[] {
  return prepareCached(
    `
    SELECT * FROM connection_events
    WHERE event_type = ?
    ORDER BY timestamp DESC
    LIMIT ?
  `
  ).all(eventType, limit) as ConnectionEvent[]
}

export function getRecentConnectionEvents(hours = 24): ConnectionEvent[] {
  return prepareCached(
    `
    SELECT * FROM connection_events
    WHERE timestamp >= datetime('now', '-' || ? || ' hours')
    ORDER BY timestamp DESC
  `
  ).all(hours) as ConnectionEvent[]
}

// ============================================
// Outbound Call Queries
// ============================================

export function logOutboundCall(call: OutboundCallInput): number {
  const stmt = prepareCached(`
    INSERT OR IGNORE INTO outbound_calls (session_id, agent_id, tool_name, tool_use_id, duration_ms, status, error)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `)
  const result = stmt.run(
    call.session_id ?? null,
    call.agent_id ?? null,
    call.tool_name,
    call.tool_use_id ?? null,
    call.duration_ms ?? null,
    call.status ?? null,
    call.error ?? null
  )
  return result.lastInsertRowid as number
}

/**
 * Batch-insert outbound calls in a single transaction. Used when parsing
 * historical transcripts replays many completed tool calls at once - one
 * transaction avoids per-row fsyncs and keeps the event loop responsive.
 */
export function logOutboundCalls(calls: OutboundCallInput[]): void {
  if (calls.length === 0) return

  const stmt = prepareCached(`
    INSERT OR IGNORE INTO outbound_calls (session_id, agent_id, tool_name, tool_use_id, duration_ms, status, error)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `)
  const db = getDatabase()
  db.transaction((rows: OutboundCallInput[]) => {
    for (const call of rows) {
      stmt.run(
        call.session_id ?? null,
        call.agent_id ?? null,
        call.tool_name,
        call.tool_use_id ?? null,
        call.duration_ms ?? null,
        call.status ?? null,
        call.error ?? null
      )
    }
  })(calls)
}

export interface OutboundCallFilters {
  limit?: number
  offset?: number
  agentId?: string
  toolName?: string
  status?: string
}

export interface OutboundCallsResult {
  calls: OutboundCall[]
  total: number
}

export function getOutboundCalls(
  limit = 100,
  agentId?: string
): OutboundCall[] {
  if (agentId) {
    return prepareCached(
      `
      SELECT * FROM outbound_calls
      WHERE agent_id = ?
      ORDER BY timestamp DESC
      LIMIT ?
    `
    ).all(agentId, limit) as OutboundCall[]
  }

  return prepareCached(
    `
    SELECT * FROM outbound_calls
    ORDER BY timestamp DESC
    LIMIT ?
  `
  ).all(limit) as OutboundCall[]
}

export function getOutboundCallsWithCount(
  filters: OutboundCallFilters = {}
): OutboundCallsResult {
  const conditions: string[] = []
  const params: (string | number)[] = []

  if (filters.agentId) {
    conditions.push('agent_id = ?')
    params.push(filters.agentId)
  }
  if (filters.toolName) {
    conditions.push('tool_name LIKE ?')
    params.push(`%${filters.toolName}%`)
  }
  if (filters.status) {
    conditions.push('status = ?')
    params.push(filters.status)
  }

  const whereClause =
    conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

  // Get count first
  const countRow = prepareCached(
    `
    SELECT COUNT(*) as total FROM outbound_calls ${whereClause}
  `
  ).get(...params) as { total: number }

  const limit = filters.limit ?? 50
  const offset = filters.offset ?? 0
  params.push(limit, offset)

  const calls = prepareCached(
    `
    SELECT * FROM outbound_calls
    ${whereClause}
    ORDER BY timestamp DESC
    LIMIT ? OFFSET ?
  `
  ).all(...params) as OutboundCall[]

  return { calls, total: countRow.total }
}

export function getOutboundCallsBySession(sessionId: string): OutboundCall[] {
  return prepareCached(
    `
    SELECT * FROM outbound_calls
    WHERE session_id = ?
    ORDER BY timestamp DESC
  `
  ).all(sessionId) as OutboundCall[]
}

export function getOutboundCallsByTool(
  toolName: string,
  limit = 100
): OutboundCall[] {
  return prepareCached(
    `
    SELECT * FROM outbound_calls
    WHERE tool_name = ?
    ORDER BY timestamp DESC
    LIMIT ?
  `
  ).all(toolName, limit) as OutboundCall[]
}

export interface OutboundCallStats {
  totalCalls: number
  uniqueTools: number
  avgDurationMs: number | null
  errorRate: number
  topTools: Array<{
    tool_name: string
    call_count: number
    avg_duration_ms: number | null
    error_count: number
  }>
}

export function getOutboundCallStats(days = 30): OutboundCallStats {
  const totalsRow = prepareCached(
    `
    SELECT
      COUNT(*) as total_calls,
      COUNT(DISTINCT tool_name) as unique_tools,
      AVG(duration_ms) as avg_duration_ms,
      SUM(CASE WHEN error IS NOT NULL THEN 1 ELSE 0 END) as error_count
    FROM outbound_calls
    WHERE timestamp >= datetime('now', '-' || ? || ' days')
  `
  ).get(days) as {
    total_calls: number
    unique_tools: number
    avg_duration_ms: number | null
    error_count: number
  }

  const topTools = prepareCached(
    `
    SELECT
      tool_name,
      COUNT(*) as call_count,
      AVG(duration_ms) as avg_duration_ms,
      SUM(CASE WHEN error IS NOT NULL THEN 1 ELSE 0 END) as error_count
    FROM outbound_calls
    WHERE timestamp >= datetime('now', '-' || ? || ' days')
    GROUP BY tool_name
    ORDER BY call_count DESC
    LIMIT 10
  `
  ).all(days) as Array<{
    tool_name: string
    call_count: number
    avg_duration_ms: number | null
    error_count: number
  }>

  const errorRate =
    totalsRow.total_calls > 0
      ? (totalsRow.error_count / totalsRow.total_calls) * 100
      : 0

  return {
    totalCalls: totalsRow.total_calls,
    uniqueTools: totalsRow.unique_tools,
    avgDurationMs: totalsRow.avg_duration_ms,
    errorRate: Math.round(errorRate * 100) / 100,
    topTools,
  }
}

// ============================================
// Security Alert Queries
// ============================================

export function createAlert(alert: AlertInput): number {
  const stmt = prepareCached(`
    INSERT INTO security_alerts (type, severity, message, details)
    VALUES (?, ?, ?, ?)
  `)
  const result = stmt.run(
    alert.type,
    alert.severity,
    alert.message,
    alert.details ?? null
  )
  return result.lastInsertRowid as number
}

export function getAlerts(
  acknowledged?: boolean,
  limit = 100
): SecurityAlert[] {
  if (acknowledged === undefined) {
    return prepareCached(
      `
      SELECT * FROM security_alerts
      ORDER BY timestamp DESC
      LIMIT ?
    `
    ).all(limit) as SecurityAlert[]
  }

  return prepareCached(
    `
    SELECT * FROM security_alerts
    WHERE acknowledged = ?
    ORDER BY timestamp DESC
    LIMIT ?
  `
  ).all(acknowledged ? 1 : 0, limit) as SecurityAlert[]
}

export function getAlert(id: number): SecurityAlert | undefined {
  return prepareCached('SELECT * FROM security_alerts WHERE id = ?').get(id) as
    | SecurityAlert
    | undefined
}

export function getUnacknowledgedAlerts(): SecurityAlert[] {
  return prepareCached(
    `
    SELECT * FROM security_alerts
    WHERE acknowledged = 0
    ORDER BY
      CASE severity
        WHEN 'critical' THEN 1
        WHEN 'high' THEN 2
        WHEN 'medium' THEN 3
        WHEN 'low' THEN 4
        ELSE 5
      END,
      timestamp DESC
  `
  ).all() as SecurityAlert[]
}

export function getAlertsBySeverity(
  severity: string,
  limit = 100
): SecurityAlert[] {
  return prepareCached(
    `
    SELECT * FROM security_alerts
    WHERE severity = ?
    ORDER BY timestamp DESC
    LIMIT ?
  `
  ).all(severity, limit) as SecurityAlert[]
}

export function getAlertsByType(type: string, limit = 100): SecurityAlert[] {
  return prepareCached(
    `
    SELECT * FROM security_alerts
    WHERE type = ?
    ORDER BY timestamp DESC
    LIMIT ?
  `
  ).all(type, limit) as SecurityAlert[]
}

export function acknowledgeAlert(id: number): void {
  const stmt = prepareCached(`
    UPDATE security_alerts SET
      acknowledged = 1,
      acknowledged_at = datetime('now')
    WHERE id = ?
  `)
  stmt.run(id)
}

export function acknowledgeAllAlerts(): number {
  const stmt = prepareCached(`
    UPDATE security_alerts SET
      acknowledged = 1,
      acknowledged_at = datetime('now')
    WHERE acknowledged = 0
  `)
  const result = stmt.run()
  return result.changes
}

export interface AlertStats {
  total: number
  unacknowledged: number
  bySeverity: Record<string, number>
  byType: Record<string, number>
  recentCount: number
}

export function getAlertStats(recentHours = 24): AlertStats {
  const countRow = prepareCached(
    `
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN acknowledged = 0 THEN 1 ELSE 0 END) as unacknowledged
    FROM security_alerts
  `
  ).get() as { total: number; unacknowledged: number }

  const severityRows = prepareCached(
    `
    SELECT severity, COUNT(*) as count
    FROM security_alerts
    GROUP BY severity
  `
  ).all() as Array<{ severity: string; count: number }>

  const typeRows = prepareCached(
    `
    SELECT type, COUNT(*) as count
    FROM security_alerts
    GROUP BY type
  `
  ).all() as Array<{ type: string; count: number }>

  const recentRow = prepareCached(
    `
    SELECT COUNT(*) as count
    FROM security_alerts
    WHERE timestamp >= datetime('now', '-' || ? || ' hours')
  `
  ).get(recentHours) as { count: number }

  const bySeverity: Record<string, number> = {}
  for (const row of severityRows) {
    bySeverity[row.severity] = row.count
  }

  const byType: Record<string, number> = {}
  for (const row of typeRows) {
    byType[row.type] = row.count
  }

  return {
    total: countRow.total,
    unacknowledged: countRow.unacknowledged,
    bySeverity,
    byType,
    recentCount: recentRow.count,
  }
}

// ============================================
// Audit Log Queries
// ============================================

export function logAudit(entry: AuditInput): number {
  const stmt = prepareCached(`
    INSERT INTO audit_log (action, entity_type, entity_id, actor, details, ip_address)
    VALUES (?, ?, ?, ?, ?, ?)
  `)
  const result = stmt.run(
    entry.action,
    entry.entity_type ?? null,
    entry.entity_id ?? null,
    entry.actor ?? null,
    entry.details ?? null,
    entry.ip_address ?? null
  )
  return result.lastInsertRowid as number
}

export interface AuditLogResult {
  entries: AuditEntry[]
  total: number
}

export function getAuditLog(filters: AuditFilters = {}): AuditEntry[] {
  const conditions: string[] = []
  const params: (string | number)[] = []

  if (filters.action) {
    conditions.push('action = ?')
    params.push(filters.action)
  }
  if (filters.entity_type) {
    conditions.push('entity_type = ?')
    params.push(filters.entity_type)
  }
  if (filters.entity_id) {
    conditions.push('entity_id = ?')
    params.push(filters.entity_id)
  }
  if (filters.actor) {
    conditions.push('actor LIKE ?')
    params.push(`%${filters.actor}%`)
  }
  if (filters.startDate) {
    conditions.push('timestamp >= ?')
    params.push(filters.startDate)
  }
  if (filters.endDate) {
    conditions.push('timestamp <= ?')
    params.push(filters.endDate)
  }

  const whereClause =
    conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
  const limit = filters.limit ?? 100
  const offset = filters.offset ?? 0

  params.push(limit, offset)

  return prepareCached(
    `
    SELECT * FROM audit_log
    ${whereClause}
    ORDER BY timestamp DESC
    LIMIT ? OFFSET ?
  `
  ).all(...params) as AuditEntry[]
}

export function getAuditLogWithCount(
  filters: AuditFilters = {}
): AuditLogResult {
  const conditions: string[] = []
  const params: (string | number)[] = []

  if (filters.action) {
    conditions.push('action = ?')
    params.push(filters.action)
  }
  if (filters.entity_type) {
    conditions.push('entity_type = ?')
    params.push(filters.entity_type)
  }
  if (filters.entity_id) {
    conditions.push('entity_id = ?')
    params.push(filters.entity_id)
  }
  if (filters.actor) {
    conditions.push('actor LIKE ?')
    params.push(`%${filters.actor}%`)
  }
  if (filters.ip_address) {
    conditions.push('ip_address LIKE ?')
    params.push(`%${filters.ip_address}%`)
  }
  if (filters.startDate) {
    conditions.push('timestamp >= ?')
    params.push(filters.startDate)
  }
  if (filters.endDate) {
    conditions.push('timestamp <= ?')
    params.push(filters.endDate)
  }

  const whereClause =
    conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

  // Get count first
  const countRow = prepareCached(
    `
    SELECT COUNT(*) as total FROM audit_log ${whereClause}
  `
  ).get(...params) as { total: number }

  const limit = filters.limit ?? 100
  const offset = filters.offset ?? 0
  params.push(limit, offset)

  const entries = prepareCached(
    `
    SELECT * FROM audit_log
    ${whereClause}
    ORDER BY timestamp DESC
    LIMIT ? OFFSET ?
  `
  ).all(...params) as AuditEntry[]

  return { entries, total: countRow.total }
}

export function getAuditEntry(id: number): AuditEntry | undefined {
  return prepareCached('SELECT * FROM audit_log WHERE id = ?').get(id) as
    | AuditEntry
    | undefined
}

export function getAuditLogByEntity(
  entityType: string,
  entityId: string
): AuditEntry[] {
  return prepareCached(
    `
    SELECT * FROM audit_log
    WHERE entity_type = ? AND entity_id = ?
    ORDER BY timestamp DESC
  `
  ).all(entityType, entityId) as AuditEntry[]
}

export function getAuditLogByActor(actor: string, limit = 100): AuditEntry[] {
  return prepareCached(
    `
    SELECT * FROM audit_log
    WHERE actor = ?
    ORDER BY timestamp DESC
    LIMIT ?
  `
  ).all(actor, limit) as AuditEntry[]
}

export function getRecentAuditLog(hours = 24): AuditEntry[] {
  return prepareCached(
    `
    SELECT * FROM audit_log
    WHERE timestamp >= datetime('now', '-' || ? || ' hours')
    ORDER BY timestamp DESC
  `
  ).all(hours) as AuditEntry[]
}

export interface AuditStats {
  totalEntries: number
  uniqueActors: number
  actionCounts: Record<string, number>
  entityTypeCounts: Record<string, number>
  recentActivityCount: number
}

export function getAuditStats(recentHours = 24): AuditStats {
  const totalsRow = prepareCached(
    `
    SELECT
      COUNT(*) as total_entries,
      COUNT(DISTINCT actor) as unique_actors
    FROM audit_log
  `
  ).get() as { total_entries: number; unique_actors: number }

  const actionRows = prepareCached(
    `
    SELECT action, COUNT(*) as count
    FROM audit_log
    GROUP BY action
    ORDER BY count DESC
  `
  ).all() as Array<{ action: string; count: number }>

  const entityRows = prepareCached(
    `
    SELECT entity_type, COUNT(*) as count
    FROM audit_log
    WHERE entity_type IS NOT NULL
    GROUP BY entity_type
    ORDER BY count DESC
  `
  ).all() as Array<{ entity_type: string; count: number }>

  const recentRow = prepareCached(
    `
    SELECT COUNT(*) as count
    FROM audit_log
    WHERE timestamp >= datetime('now', '-' || ? || ' hours')
  `
  ).get(recentHours) as { count: number }

  const actionCounts: Record<string, number> = {}
  for (const row of actionRows) {
    actionCounts[row.action] = row.count
  }

  const entityTypeCounts: Record<string, number> = {}
  for (const row of entityRows) {
    entityTypeCounts[row.entity_type] = row.count
  }

  return {
    totalEntries: totalsRow.total_entries,
    uniqueActors: totalsRow.unique_actors,
    actionCounts,
    entityTypeCounts,
    recentActivityCount: recentRow.count,
  }
}

// ============================================
// Combined Security Dashboard Stats
// ============================================

export interface SecurityDashboardStats {
  devices: {
    total: number
    active: number
    recentConnections: number
  }
  alerts: {
    total: number
    unacknowledged: number
    critical: number
    high: number
  }
  pairing: {
    pending: number
    totalRequests: number
  }
  audit: {
    recentEntries: number
    uniqueActors: number
  }
}

export function getSecurityDashboardStats(): SecurityDashboardStats {
  // Device stats
  const deviceRow = prepareCached(
    `
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active
    FROM devices
  `
  ).get() as { total: number; active: number }

  const recentConnectionsRow = prepareCached(
    `
    SELECT COUNT(*) as count
    FROM connection_events
    WHERE timestamp >= datetime('now', '-24 hours')
  `
  ).get() as { count: number }

  // Alert stats
  const alertRow = prepareCached(
    `
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN acknowledged = 0 THEN 1 ELSE 0 END) as unacknowledged,
      SUM(CASE WHEN severity = 'critical' AND acknowledged = 0 THEN 1 ELSE 0 END) as critical,
      SUM(CASE WHEN severity = 'high' AND acknowledged = 0 THEN 1 ELSE 0 END) as high
    FROM security_alerts
  `
  ).get() as {
    total: number
    unacknowledged: number
    critical: number
    high: number
  }

  // Pairing stats
  const pairingRow = prepareCached(
    `
    SELECT
      SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
      COUNT(*) as total
    FROM pairing_requests
  `
  ).get() as { pending: number; total: number }

  // Audit stats
  const auditRow = prepareCached(
    `
    SELECT
      COUNT(*) as recent_entries,
      COUNT(DISTINCT actor) as unique_actors
    FROM audit_log
    WHERE timestamp >= datetime('now', '-24 hours')
  `
  ).get() as { recent_entries: number; unique_actors: number }

  return {
    devices: {
      total: deviceRow.total,
      active: deviceRow.active,
      recentConnections: recentConnectionsRow.count,
    },
    alerts: {
      total: alertRow.total,
      unacknowledged: alertRow.unacknowledged,
      critical: alertRow.critical,
      high: alertRow.high,
    },
    pairing: {
      pending: pairingRow.pending,
      totalRequests: pairingRow.total,
    },
    audit: {
      recentEntries: auditRow.recent_entries,
      uniqueActors: auditRow.unique_actors,
    },
  }
}
