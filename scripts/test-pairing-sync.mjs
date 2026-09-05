import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const home = fs.mkdtempSync(path.join(os.tmpdir(), 'clawalytics-pairing-'))
process.env.USERPROFILE = home
process.env.HOME = home

const { default: Database } = await import('better-sqlite3')
const { closeDatabase, getDatabase } = await import('../src/server/db/schema.ts')
const {
  createPairingRequest,
  getPairingRequests,
  getDevices,
  getAuditLogWithCount,
  reconcileSecurityState,
  upsertDevice,
} = await import('../src/server/db/queries-security.ts')
const { loadPairedDevicesSnapshot, loadPendingRequestsSnapshot } = await import(
  '../src/server/parser/openclaw/device-loader.ts'
)
const { startSecurityWatcher, stopSecurityWatcher } = await import(
  '../src/server/parser/security-watcher.ts'
)

const dbPath = path.join(home, '.clawalytics', 'clawalytics.db')

function resetDatabaseFile() {
  for (const suffix of ['', '-wal', '-shm']) {
    fs.rmSync(dbPath + suffix, { force: true })
  }
}

/**
 * Build a database file that looks like it stopped at the given schema
 * version, so the real migration chain runs over realistic legacy state.
 */
function seedLegacyDatabase(stopVersion) {
  fs.mkdirSync(path.dirname(dbPath), { recursive: true })
  const db = new Database(dbPath)
  db.exec(`
    CREATE TABLE pairing_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      device_id TEXT NOT NULL,
      device_name TEXT,
      requested_at TEXT DEFAULT CURRENT_TIMESTAMP,
      responded_at TEXT,
      status TEXT DEFAULT 'pending',
      response TEXT
    );
    CREATE TABLE schema_version (
      version INTEGER PRIMARY KEY,
      description TEXT NOT NULL,
      applied_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
    INSERT INTO schema_version (version, description) VALUES
      (1, 'seed'), (2, 'seed'), (3, 'seed');
  `)
  if (stopVersion >= 4) {
    db.exec(`
      ALTER TABLE pairing_requests ADD COLUMN source_request_id TEXT;
      CREATE UNIQUE INDEX idx_pairing_requests_source_request_id
        ON pairing_requests(source_request_id)
        WHERE source_request_id IS NOT NULL;
      INSERT INTO schema_version (version, description) VALUES (4, 'seed');
    `)
  }
  return db
}

function pairingRequestsBySource(sourceId) {
  return getPairingRequests().filter(
    (request) => request.source_request_id === sourceId
  )
}

function pairingRequestsByDevice(deviceId) {
  return getPairingRequests().filter(
    (request) => request.device_id === deviceId
  )
}

function auditCount() {
  return getAuditLogWithCount({ limit: 1 }).total
}

async function waitFor(description, predicate, timeoutMs = 8000) {
  const deadline = Date.now() + timeoutMs
  for (;;) {
    let value
    try {
      value = predicate()
    } catch (error) {
      value = false
      console.warn(`waitFor predicate error (${description}):`, error)
    }
    if (value) return value
    if (Date.now() > deadline) {
      throw new Error(`Timed out waiting for: ${description}`)
    }
    await new Promise((resolve) => setTimeout(resolve, 50))
  }
}

function writePaired(devices) {
  fs.writeFileSync(
    path.join(home, '.openclaw', 'nodes', 'paired.json'),
    JSON.stringify({ devices })
  )
}

function writePending(requests) {
  fs.writeFileSync(
    path.join(home, '.openclaw', 'nodes', 'pending.json'),
    JSON.stringify({ requests })
  )
}

function pairedEntry(id, name) {
  return {
    id,
    name,
    type: 'mobile',
    pairedAt: '2026-09-05T00:00:00.000Z',
  }
}

function pendingEntry(id, name) {
  return {
    id,
    deviceName: name,
    type: 'mobile',
    requestedAt: '2026-09-05T00:00:00.000Z',
  }
}

try {
  // ============================================
  // Migration v5: legacy pending rows without source_request_id
  // ============================================

  // Path A: a v3-era database with a single legacy pending row must be
  // upgraded in place - the same row gains source_request_id = device_id and
  // stays pending; no second request may appear.
  resetDatabaseFile()
  {
    const legacy = seedLegacyDatabase(3)
    legacy
      .prepare(
        `INSERT INTO pairing_requests (device_id, device_name, status)
         VALUES ('legacy-device', 'Legacy Phone', 'pending')`
      )
      .run()
    legacy.close()

    getDatabase()
    const rows = pairingRequestsBySource('legacy-device')
    assert.equal(rows.length, 1)
    assert.equal(rows[0].source_request_id, 'legacy-device')
    assert.equal(rows[0].status, 'pending')

    // Reopening the database must not duplicate or downgrade the repair.
    closeDatabase()
    getDatabase()
    assert.equal(pairingRequestsBySource('legacy-device').length, 1)
    closeDatabase()
  }
  resetDatabaseFile()

  // Path B: a database where v4 already ran and a legacy null-ID pending
  // coexists with the new canonical row. History is kept, but only one
  // non-terminal request may remain for the device.
  {
    const legacy = seedLegacyDatabase(4)
    legacy
      .prepare(
        `INSERT INTO pairing_requests (device_id, device_name, status)
         VALUES ('device-b', 'Old Tablet', 'pending')`
      )
      .run()
    legacy
      .prepare(
        `INSERT INTO pairing_requests (device_id, device_name, status, source_request_id)
         VALUES ('device-b', 'New Tablet', 'pending', 'device-b')`
      )
      .run()
    legacy.close()

    getDatabase()
    const rows = pairingRequestsByDevice('device-b')
    assert.equal(rows.length, 2)
    const nonTerminal = rows.filter((row) => row.status === 'pending')
    assert.equal(nonTerminal.length, 1)
    assert.equal(nonTerminal[0].source_request_id, 'device-b')
    closeDatabase()
  }
  resetDatabaseFile()

  // ============================================
  // Reconciliation primitives
  // ============================================

  fs.mkdirSync(path.join(home, '.clawalytics'), { recursive: true })
  getDatabase()

  createPairingRequest({
    device_id: 'device-1',
    device_name: 'Phone',
    source_request_id: 'request-1',
  })
  createPairingRequest({
    device_id: 'device-1',
    device_name: 'Phone',
    source_request_id: 'request-1',
  })
  assert.equal(pairingRequestsBySource('request-1').length, 1)

  // Device paired while the request is absent from pending -> resolved.
  reconcileSecurityState([pairedEntry('device-1', 'Phone')], [])
  assert.equal(
    getPairingRequests().find(
      (request) => request.source_request_id === 'request-1'
    )?.status,
    'resolved'
  )

  createPairingRequest({
    device_id: 'device-2',
    device_name: 'Tablet',
    source_request_id: 'request-2',
  })
  reconcileSecurityState([], [])
  assert.equal(
    getPairingRequests().find(
      (request) => request.source_request_id === 'request-2'
    )?.status,
    'removed'
  )

  // Reconciling the same snapshots again must report no changes.
  const repeatChanges = reconcileSecurityState([], [])
  assert.equal(repeatChanges.length, 0)

  // ============================================
  // Watcher: startup reconciliation and idempotence
  // ============================================

  const openClawPath = path.join(home, '.openclaw')
  const gatewayLogsPath = path.join(home, 'gateway-logs')
  fs.mkdirSync(path.join(openClawPath, 'nodes'), { recursive: true })
  writePaired([])
  writePending([pendingEntry('request-3', 'Laptop')])

  for (let run = 0; run < 2; run += 1) {
    startSecurityWatcher({ openClawPath, gatewayLogsPath })
    stopSecurityWatcher()
  }
  assert.equal(pairingRequestsBySource('request-3').length, 1)
  assert.equal(
    getPairingRequests().find(
      (request) => request.source_request_id === 'request-3'
    )?.status,
    'pending'
  )
  // Startup reconciliation never emits audit/alert notifications, and a
  // repeated identical snapshot must not add any records.
  assert.equal(auditCount(), 0)

  // Missing pending.json is "temporarily unavailable" - state is preserved.
  fs.unlinkSync(path.join(openClawPath, 'nodes', 'pending.json'))
  assert.equal(loadPendingRequestsSnapshot(openClawPath).status, 'missing')
  startSecurityWatcher({ openClawPath, gatewayLogsPath })
  stopSecurityWatcher()
  assert.equal(
    getPairingRequests().find(
      (request) => request.source_request_id === 'request-3'
    )?.status,
    'pending'
  )

  // A valid empty snapshot is authoritative: the request is gone.
  writePending([])
  startSecurityWatcher({ openClawPath, gatewayLogsPath })
  stopSecurityWatcher()
  assert.equal(
    getPairingRequests().find(
      (request) => request.source_request_id === 'request-3'
    )?.status,
    'removed'
  )

  // A valid empty paired snapshot retires stale active devices at startup.
  upsertDevice({ id: 'stale-device', name: 'Stale', type: 'mobile' })
  writePaired([])
  writePending([])
  startSecurityWatcher({ openClawPath, gatewayLogsPath })
  stopSecurityWatcher()
  assert.equal(
    getDevices().find((device) => device.id === 'stale-device')?.status,
    'removed'
  )

  // Broken JSON is an error snapshot: DB state is preserved, no crash.
  fs.writeFileSync(path.join(openClawPath, 'nodes', 'pending.json'), '{broken json')
  assert.equal(loadPendingRequestsSnapshot(openClawPath).status, 'error')
  createPairingRequest({
    device_id: 'request-4',
    device_name: 'Workstation',
    source_request_id: 'request-4',
  })
  startSecurityWatcher({ openClawPath, gatewayLogsPath })
  stopSecurityWatcher()
  assert.equal(
    getPairingRequests().find(
      (request) => request.source_request_id === 'request-4'
    )?.status,
    'pending'
  )

  // ============================================
  // Watcher: runtime convergence via file events
  // ============================================

  writePaired([])
  writePending([pendingEntry('device-5', 'Phone 5')])
  startSecurityWatcher({ openClawPath, gatewayLogsPath })
  try {
    await waitFor('device-5 pending', () =>
      pairingRequestsBySource('device-5').some(
        (row) => row.status === 'pending'
      )
    )

    // Order A: device appears in paired first, then the request leaves
    // pending. The request must end resolved.
    writePaired([pairedEntry('device-5', 'Phone 5')])
    await waitFor('device-5 resolved after paired appears', () =>
      pairingRequestsBySource('device-5').every(
        (row) => row.status === 'resolved'
      )
    )
    writePending([])
    await waitFor('state stable after pending empties', () =>
      pairingRequestsBySource('device-5').every(
        (row) => row.status === 'resolved'
      )
    )

    // Order B: the request leaves pending BEFORE the device is paired. The
    // request is removed first, then corrected to resolved (removed ->
    // resolved is allowed; resolved history is never downgraded).
    writePending([pendingEntry('device-6', 'Phone 6')])
    await waitFor('device-6 pending', () =>
      pairingRequestsBySource('device-6').some(
        (row) => row.status === 'pending'
      )
    )
    writePending([])
    await waitFor('device-6 removed', () =>
      pairingRequestsBySource('device-6').every(
        (row) => row.status === 'removed'
      )
    )
    writePaired([pairedEntry('device-5', 'Phone 5'), pairedEntry('device-6', 'Phone 6')])
    await waitFor('device-6 corrected to resolved', () =>
      pairingRequestsBySource('device-6').every(
        (row) => row.status === 'resolved'
      )
    )

    // Device removal and re-appearance. A resolved request is never
    // downgraded just because its device disappears again later.
    writePaired([pairedEntry('device-5', 'Phone 5')])
    await waitFor('device-6 removed', () =>
      getDevices().find((device) => device.id === 'device-6')?.status ===
      'removed'
    )
    assert.ok(
      pairingRequestsBySource('device-6').every(
        (row) => row.status === 'resolved'
      )
    )
    writePaired([pairedEntry('device-5', 'Phone 5'), pairedEntry('device-6', 'Phone 6')])
    await waitFor('device-6 active again', () =>
      getDevices().find((device) => device.id === 'device-6')?.status ===
      'active'
    )

    // Rewriting identical snapshot content must not duplicate audit entries
    // or records.
    const auditBefore = auditCount()
    writePaired([pairedEntry('device-5', 'Phone 5'), pairedEntry('device-6', 'Phone 6')])
    await new Promise((resolve) => setTimeout(resolve, 1200))
    assert.equal(auditCount(), auditBefore)
    assert.equal(pairingRequestsBySource('device-6').length, 1)

    // Transient corruption followed by recovery converges automatically.
    fs.writeFileSync(
      path.join(openClawPath, 'nodes', 'pending.json'),
      '{"requests":[{"id":'
    )
    await new Promise((resolve) => setTimeout(resolve, 300))
    writePending([pendingEntry('device-7', 'Phone 7')])
    await waitFor('device-7 pending after recovery', () =>
      pairingRequestsBySource('device-7').some(
        (row) => row.status === 'pending'
      )
    )
  } finally {
    stopSecurityWatcher()
  }

  // ============================================
  // Malformed snapshot entries: rejected, no DB writes, backend still starts
  // ============================================

  writePaired([{ id: 'x' }])
  writePending([{}])
  assert.equal(loadPairedDevicesSnapshot(openClawPath).status, 'error')
  assert.equal(loadPendingRequestsSnapshot(openClawPath).status, 'error')

  const requestCountBefore = getPairingRequests().length
  const deviceCountBefore = getDevices().length
  startSecurityWatcher({ openClawPath, gatewayLogsPath })
  stopSecurityWatcher()
  assert.equal(getPairingRequests().length, requestCountBefore)
  assert.equal(getDevices().length, deviceCountBefore)

  // Wrong field types are equally invalid.
  writePaired([{ id: 123, name: 'Phone', type: 'mobile', pairedAt: 'x' }])
  writePending([{ id: 'request-8', deviceName: 42, type: 'mobile', requestedAt: 'x' }])
  assert.equal(loadPairedDevicesSnapshot(openClawPath).status, 'error')
  assert.equal(loadPendingRequestsSnapshot(openClawPath).status, 'error')
  startSecurityWatcher({ openClawPath, gatewayLogsPath })
  stopSecurityWatcher()
  assert.equal(getPairingRequests().length, requestCountBefore)
  assert.equal(getDevices().length, deviceCountBefore)

  // Recovery: valid snapshots are accepted again afterwards.
  writePaired([pairedEntry('device-5', 'Phone 5'), pairedEntry('device-6', 'Phone 6')])
  writePending([pendingEntry('device-8', 'Phone 8')])
  startSecurityWatcher({ openClawPath, gatewayLogsPath })
  try {
    await waitFor('device-8 pending after valid snapshots return', () =>
      pairingRequestsBySource('device-8').some(
        (row) => row.status === 'pending'
      )
    )
  } finally {
    stopSecurityWatcher()
  }
} finally {
  stopSecurityWatcher()
  closeDatabase()
  fs.rmSync(home, { recursive: true, force: true })
}
