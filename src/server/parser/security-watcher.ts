import type { FSWatcher } from 'chokidar'
import {
  getDevice,
  logConnectionEvent,
  logAudit,
  updateDeviceLastSeen,
  reconcileSecurityState,
} from '../db/queries-security.js'
import { AlertService } from '../services/alert-service.js'
import {
  watchDeviceFiles,
  stopDeviceWatcher,
  loadPairedDevicesSnapshot,
  loadPendingRequestsSnapshot,
  type PairedDevice,
  type PendingRequest,
} from './openclaw/device-loader.js'
import {
  watchGatewayLogs,
  stopGatewayWatcher,
  type GatewayLogEntry,
} from './openclaw/gateway-parser.js'

// ============================================
// Interfaces
// ============================================

export interface SecurityWatcherConfig {
  /** Path to OpenClaw directory (e.g., ~/.openclaw) */
  openClawPath: string
  /** Path to gateway logs (e.g., /tmp/openclaw) */
  gatewayLogsPath: string
  /** Enable or disable the security watcher */
  enabled?: boolean
}

interface ActiveWatchers {
  deviceWatcher: FSWatcher | null
  gatewayWatcher: FSWatcher | null
}

// ============================================
// State
// ============================================

let activeWatchers: ActiveWatchers = {
  deviceWatcher: null,
  gatewayWatcher: null,
}

let isRunning = false
let activeOpenClawPath = ''
let alertService: AlertService | null = null

// Snapshot sync retries: a single queued timer walks the backoff ladder
// while either snapshot is unavailable. A new file event resets it.
const SNAPSHOT_RETRY_DELAYS_MS = [100, 250, 500, 1000, 2000]
let snapshotRetryTimer: ReturnType<typeof setTimeout> | null = null
let snapshotRetryAttempt = 0
// The first successful reconcile reflects historical state; it must not
// spam audit/alert notifications. Only later changes notify.
let hasCompletedInitialSync = false

// ============================================
// Main watcher functions
// ============================================

/**
 * Start the security watcher
 *
 * Watches:
 * - Device pairing files (paired.json, pending.json)
 * - Gateway logs for connection events
 */
export function startSecurityWatcher(config: SecurityWatcherConfig): void {
  if (isRunning) {
    console.log('Security watcher already running')
    return
  }

  if (config.enabled === false) {
    console.log('Security watcher disabled by config')
    return
  }

  alertService = AlertService.getInstance()
  activeOpenClawPath = config.openClawPath
  hasCompletedInitialSync = false

  console.log('Starting security watcher...')

  isRunning = true

  // Initial reconciliation: bring the database in line with whatever the
  // snapshot files currently contain, without emitting notifications for
  // historical differences. If the snapshots are not readable yet, the
  // retry queue keeps trying until they are.
  synchronizeSnapshots()

  // Watch device files: any change to either snapshot triggers a full
  // re-read + reconcile, regardless of which file changed or in what order.
  activeWatchers.deviceWatcher = watchDeviceFiles(
    config.openClawPath,
    handleSnapshotsSignal
  )

  // Watch gateway logs
  activeWatchers.gatewayWatcher = watchGatewayLogs(
    config.gatewayLogsPath,
    (event: GatewayLogEntry) => {
      handleGatewayEvent(event, alertService as AlertService)
    }
  )

  console.log('Security watcher started')
}

/**
 * Stop the security watcher
 */
export function stopSecurityWatcher(): void {
  if (!isRunning) {
    console.log('Security watcher not running')
    return
  }

  console.log('Stopping security watcher...')

  clearSnapshotRetry()
  stopDeviceWatcher()
  stopGatewayWatcher()

  activeWatchers = {
    deviceWatcher: null,
    gatewayWatcher: null,
  }

  isRunning = false
  activeOpenClawPath = ''
  alertService = null
  hasCompletedInitialSync = false
  console.log('Security watcher stopped')
}

/**
 * Check if the security watcher is running
 */
export function isSecurityWatcherRunning(): boolean {
  return isRunning
}

// ============================================
// Snapshot synchronization
// ============================================

function clearSnapshotRetry(): void {
  if (snapshotRetryTimer) {
    clearTimeout(snapshotRetryTimer)
    snapshotRetryTimer = null
  }
  snapshotRetryAttempt = 0
}

function scheduleSnapshotRetry(): void {
  if (!isRunning || snapshotRetryTimer) {
    return
  }
  const delay =
    SNAPSHOT_RETRY_DELAYS_MS[
      Math.min(snapshotRetryAttempt, SNAPSHOT_RETRY_DELAYS_MS.length - 1)
    ]
  snapshotRetryAttempt += 1
  snapshotRetryTimer = setTimeout(() => {
    snapshotRetryTimer = null
    synchronizeSnapshots()
  }, delay)
  snapshotRetryTimer.unref?.()
}

function handleSnapshotsSignal(): void {
  if (!isRunning) {
    return
  }
  // A fresh file event means readable data may be available right now:
  // reset any pending backoff and reconcile immediately.
  clearSnapshotRetry()
  synchronizeSnapshots()
}

/**
 * Re-read both snapshots and reconcile the database with them. If either
 * snapshot is missing or invalid, the last reconciled state is preserved and
 * a retry is queued. Returns true when a reconcile actually ran.
 */
function synchronizeSnapshots(): boolean {
  if (!isRunning || !activeOpenClawPath) {
    return false
  }

  const pairedSnapshot = loadPairedDevicesSnapshot(activeOpenClawPath)
  if (pairedSnapshot.status !== 'ok') {
    scheduleSnapshotRetry()
    return false
  }
  const pendingSnapshot = loadPendingRequestsSnapshot(activeOpenClawPath)
  if (pendingSnapshot.status !== 'ok') {
    scheduleSnapshotRetry()
    return false
  }

  clearSnapshotRetry()
  const changes = reconcileSecurityState(
    pairedSnapshot.items.map((device) => ({
      id: device.id,
      name: device.name,
      type: device.type,
    })),
    pendingSnapshot.items.map((request) => ({
      id: request.id,
      deviceName: request.deviceName,
      type: request.type,
      requestedAt: request.requestedAt,
    }))
  )

  if (!hasCompletedInitialSync) {
    hasCompletedInitialSync = true
    console.log(
      `Security snapshots reconciled: ${pairedSnapshot.items.length} paired devices, ${pendingSnapshot.items.length} pending requests`
    )
    return true
  }

  notifySnapshotChanges(changes, pairedSnapshot.items, pendingSnapshot.items)
  return true
}

function notifySnapshotChanges(
  changes: ReturnType<typeof reconcileSecurityState>,
  pairedDevices: PairedDevice[],
  pendingRequests: PendingRequest[]
): void {
  if (changes.length === 0 || !alertService) {
    return
  }

  const pairedById = new Map(pairedDevices.map((device) => [device.id, device]))
  const pendingById = new Map(
    pendingRequests.map((request) => [request.id, request])
  )

  for (const change of changes) {
    if (change.kind === 'device') {
      if (change.to === 'active') {
        const device = pairedById.get(change.id)
        console.log(`Device paired: ${device?.name ?? change.id}`)
        logAudit({
          action: 'device_paired',
          entity_type: 'device',
          entity_id: change.id,
          details: device
            ? JSON.stringify({
                name: device.name,
                type: device.type,
                pairedAt: device.pairedAt,
              })
            : null,
        })
        alertService.processEvent({
          type: 'device_paired',
          deviceId: change.id,
          name: device?.name,
          deviceType: device?.type,
          pairedAt: device?.pairedAt,
        })
      } else if (change.to === 'removed') {
        console.log(`Device removed: ${change.id}`)
        // The device is no longer in the snapshot; recover its last known
        // identity from the database for the audit trail.
        const device = getDevice(change.id)
        logAudit({
          action: 'device_removed',
          entity_type: 'device',
          entity_id: change.id,
          details: device
            ? JSON.stringify({ name: device.name, type: device.type })
            : null,
        })
        alertService.processEvent({
          type: 'device_removed',
          deviceId: change.id,
          name: device?.name ?? undefined,
        })
      }
      continue
    }

    if (change.to === 'pending') {
      const request = pendingById.get(change.id)
      console.log(`New pairing request: ${request?.deviceName ?? change.id}`)
      logAudit({
        action: 'pairing_request_created',
        entity_type: 'pairing_request',
        entity_id: change.id,
        details: JSON.stringify({
          deviceName: request?.deviceName ?? null,
          type: request?.type ?? null,
          requestedAt: request?.requestedAt ?? null,
        }),
      })
      alertService.processEvent({
        type: 'pairing_request',
        deviceId: change.id,
        deviceName: request?.deviceName,
        deviceType: request?.type,
        requestedAt: request?.requestedAt,
      })
    } else if (change.to === 'resolved') {
      logAudit({
        action: 'pairing_request_resolved',
        entity_type: 'pairing_request',
        entity_id: change.id,
      })
    } else if (change.to === 'removed') {
      logAudit({
        action: 'pairing_request_removed',
        entity_type: 'pairing_request',
        entity_id: change.id,
      })
    }
  }
}

// ============================================
// Gateway event handlers
// ============================================

function handleGatewayEvent(
  event: GatewayLogEntry,
  alertServiceInstance: AlertService
): void {
  // Log connection event to database
  logConnectionEvent({
    device_id: event.deviceId ?? null,
    event_type: event.event,
    ip_address: event.ip ?? null,
    details: JSON.stringify({
      level: event.level,
      message: event.message,
      error: event.error,
    }),
  })

  // Update device last seen if we have a device ID
  if (
    event.deviceId &&
    (event.event === 'connection' || event.event === 'auth_success')
  ) {
    updateDeviceLastSeen(event.deviceId)
  }

  // Log audit entry for significant events
  if (event.event === 'auth_failure' || event.level === 'ERROR') {
    logAudit({
      action: `gateway_${event.event}`,
      entity_type: 'connection',
      entity_id: event.deviceId ?? null,
      ip_address: event.ip ?? null,
      details: JSON.stringify({
        level: event.level,
        message: event.message,
        error: event.error,
      }),
    })
  }

  // Process through alert service
  alertServiceInstance.processEvent(event)
}
