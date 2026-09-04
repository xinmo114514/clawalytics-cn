import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const home = fs.mkdtempSync(path.join(os.tmpdir(), 'clawalytics-pairing-'))
process.env.USERPROFILE = home
process.env.HOME = home

const { closeDatabase, getDatabase } = await import('../src/server/db/schema.ts')
const {
  createPairingRequest,
  getPairingRequests,
  reconcilePairingRequests,
} = await import('../src/server/db/queries-security.ts')
const { loadPendingRequestsSnapshot } = await import(
  '../src/server/parser/openclaw/device-loader.ts'
)
const { startSecurityWatcher, stopSecurityWatcher } = await import(
  '../src/server/parser/security-watcher.ts'
)

try {
  fs.mkdirSync(path.join(home, '.clawalytics'), { recursive: true })
  const nodes = path.join(home, '.openclaw', 'nodes')
  fs.mkdirSync(nodes, { recursive: true })
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
  assert.equal(
    getPairingRequests().filter(
      (request) => request.source_request_id === 'request-1'
    ).length,
    1
  )

  reconcilePairingRequests([], new Set(['device-1']))
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
  reconcilePairingRequests([], new Set())
  assert.equal(
    getPairingRequests().find(
      (request) => request.source_request_id === 'request-2'
    )?.status,
    'removed'
  )

  const openClawPath = path.join(home, '.openclaw')
  const gatewayLogsPath = path.join(home, 'gateway-logs')
  fs.writeFileSync(
    path.join(nodes, 'paired.json'),
    JSON.stringify({ devices: [] })
  )
  fs.writeFileSync(
    path.join(nodes, 'pending.json'),
    JSON.stringify({
      requests: [
        {
          id: 'request-3',
          deviceName: 'Laptop',
          type: 'desktop',
          requestedAt: '2026-09-04T00:00:00.000Z',
        },
      ],
    })
  )

  for (let run = 0; run < 2; run += 1) {
    startSecurityWatcher({ openClawPath, gatewayLogsPath })
    stopSecurityWatcher()
  }
  assert.equal(
    getPairingRequests().filter(
      (request) => request.source_request_id === 'request-3'
    ).length,
    1
  )
  assert.equal(
    getPairingRequests().find(
      (request) => request.source_request_id === 'request-3'
    )?.status,
    'pending'
  )

  fs.unlinkSync(path.join(nodes, 'pending.json'))
  assert.equal(loadPendingRequestsSnapshot(openClawPath).status, 'missing')
  startSecurityWatcher({ openClawPath, gatewayLogsPath })
  stopSecurityWatcher()
  assert.equal(
    getPairingRequests().find(
      (request) => request.source_request_id === 'request-3'
    )?.status,
    'pending'
  )

  fs.writeFileSync(
    path.join(nodes, 'pending.json'),
    JSON.stringify({ requests: [] })
  )
  startSecurityWatcher({ openClawPath, gatewayLogsPath })
  stopSecurityWatcher()
  assert.equal(
    getPairingRequests().find(
      (request) => request.source_request_id === 'request-3'
    )?.status,
    'removed'
  )

  fs.writeFileSync(path.join(nodes, 'pending.json'), '{broken json')
  assert.equal(loadPendingRequestsSnapshot(openClawPath).status, 'error')
  createPairingRequest({
    device_id: 'device-4',
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
} finally {
  stopSecurityWatcher()
  closeDatabase()
  fs.rmSync(home, { recursive: true, force: true })
}
