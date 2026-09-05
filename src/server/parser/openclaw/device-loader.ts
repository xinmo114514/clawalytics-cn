import path from 'path'
import chokidar, { type FSWatcher } from 'chokidar'
import fs from 'fs'

// ============================================
// Interfaces
// ============================================

export interface PairedDevice {
  id: string
  name: string
  type: string // "mobile", "desktop", "browser"
  pairedAt: string
  publicKey?: string
}

export interface PendingRequest {
  id: string
  deviceName: string
  requestedAt: string
  type: string
}

export type SnapshotResult<T> =
  | { status: 'ok'; items: T[] }
  | { status: 'missing'; items: [] }
  | { status: 'error'; items: []; error: Error }

interface PairedDevicesFile {
  devices: unknown
}

interface PendingRequestsFile {
  requests: unknown
}

/**
 * Invoked whenever either snapshot file may have changed. Consumers must
 * re-read BOTH snapshots and reconcile; individual file deltas are not
 * reported because the two files can be written in any order.
 */
export type SnapshotsChangedListener = () => void

// ============================================
// Validation
// ============================================

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim() !== ''
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

// ============================================
// Load functions
// ============================================

/**
 * Load paired devices from the paired.json file. An 'ok' snapshot guarantees
 * every entry passed runtime validation; 'missing' and 'error' mean the
 * snapshot is temporarily unavailable and must never be treated as
 * authoritative (no deletions based on it).
 */
export function loadPairedDevicesSnapshot(
  openClawPath: string
): SnapshotResult<PairedDevice> {
  const filePath = path.join(openClawPath, 'nodes', 'paired.json')

  if (!fs.existsSync(filePath)) {
    return { status: 'missing', items: [] }
  }

  let data: PairedDevicesFile
  try {
    data = JSON.parse(fs.readFileSync(filePath, 'utf-8')) as PairedDevicesFile
  } catch (error) {
    console.error('Failed to parse paired devices:', error)
    return {
      status: 'error',
      items: [],
      error: error instanceof Error ? error : new Error(String(error)),
    }
  }

  if (!Array.isArray(data.devices)) {
    console.warn('paired.json has no devices array')
    return {
      status: 'error',
      items: [],
      error: new Error('paired.json has no devices array'),
    }
  }

  const items: PairedDevice[] = []
  for (const [index, entry] of data.devices.entries()) {
    if (
      !isRecord(entry) ||
      !isNonEmptyString(entry.id) ||
      !isNonEmptyString(entry.name) ||
      !isNonEmptyString(entry.type) ||
      !isNonEmptyString(entry.pairedAt) ||
      (entry.publicKey !== undefined && typeof entry.publicKey !== 'string')
    ) {
      console.warn(`paired.json entry at index ${index} is invalid`)
      return {
        status: 'error',
        items: [],
        error: new Error(
          `paired.json entry at index ${index} is invalid: required fields must be non-empty strings`
        ),
      }
    }
    items.push({
      id: entry.id,
      name: entry.name,
      type: entry.type,
      pairedAt: entry.pairedAt,
      ...(entry.publicKey !== undefined ? { publicKey: entry.publicKey } : {}),
    })
  }

  return { status: 'ok', items }
}

/**
 * Load pending pairing requests from the pending.json file. An 'ok' snapshot
 * guarantees every entry passed runtime validation.
 */
export function loadPendingRequestsSnapshot(
  openClawPath: string
): SnapshotResult<PendingRequest> {
  const filePath = path.join(openClawPath, 'nodes', 'pending.json')

  if (!fs.existsSync(filePath)) {
    return { status: 'missing', items: [] }
  }

  let data: PendingRequestsFile
  try {
    data = JSON.parse(fs.readFileSync(filePath, 'utf-8')) as PendingRequestsFile
  } catch (error) {
    console.error('Failed to parse pending requests:', error)
    return {
      status: 'error',
      items: [],
      error: error instanceof Error ? error : new Error(String(error)),
    }
  }

  if (!Array.isArray(data.requests)) {
    console.warn('pending.json has no requests array')
    return {
      status: 'error',
      items: [],
      error: new Error('pending.json has no requests array'),
    }
  }

  const items: PendingRequest[] = []
  for (const [index, entry] of data.requests.entries()) {
    if (
      !isRecord(entry) ||
      !isNonEmptyString(entry.id) ||
      !isNonEmptyString(entry.deviceName) ||
      !isNonEmptyString(entry.type) ||
      !isNonEmptyString(entry.requestedAt)
    ) {
      console.warn(`pending.json entry at index ${index} is invalid`)
      return {
        status: 'error',
        items: [],
        error: new Error(
          `pending.json entry at index ${index} is invalid: required fields must be non-empty strings`
        ),
      }
    }
    items.push({
      id: entry.id,
      deviceName: entry.deviceName,
      requestedAt: entry.requestedAt,
      type: entry.type,
    })
  }

  return { status: 'ok', items }
}

// ============================================
// Watch functions
// ============================================

/**
 * Watch device pairing files for changes. Any add/change/unlink of either
 * file emits a single "snapshots may have changed" signal; the consumer
 * re-reads both snapshots and reconciles.
 */
export function watchDeviceFiles(
  openClawPath: string,
  onSnapshotsChanged: SnapshotsChangedListener
): FSWatcher | null {
  const nodesPath = path.join(openClawPath, 'nodes')
  const pairedPath = path.join(nodesPath, 'paired.json')
  const pendingPath = path.join(nodesPath, 'pending.json')

  // Check if the OpenClaw nodes directory exists
  if (!fs.existsSync(nodesPath)) {
    console.log('OpenClaw nodes path does not exist, skipping device watcher')
    return null
  }

  // Watch both files
  deviceWatcher = chokidar.watch([pairedPath, pendingPath], {
    persistent: true,
    ignoreInitial: true,
    awaitWriteFinish: {
      stabilityThreshold: 100,
      pollInterval: 50,
    },
  })

  const emitSignal = (filePath: string, reason: string) => {
    if (
      !filePath.endsWith('paired.json') &&
      !filePath.endsWith('pending.json')
    ) {
      return
    }
    try {
      onSnapshotsChanged()
    } catch (error) {
      console.error(`Error handling ${reason} (${filePath}):`, error)
    }
  }

  deviceWatcher.on('change', (filePath) => emitSignal(filePath, 'file change'))
  deviceWatcher.on('add', (filePath) => emitSignal(filePath, 'file creation'))
  // Writes that land while the initial scan is still running are absorbed
  // into that scan and never surface as 'change' events. The 'ready' signal
  // re-reads both snapshots once the scan completes so nothing is lost.
  deviceWatcher.on('ready', () => emitSignal(pairedPath, 'watcher ready'))
  deviceWatcher.on('unlink', (filePath) => {
    if (filePath.endsWith('paired.json')) {
      console.warn(
        'paired.json became unavailable; preserving the last reconciled state'
      )
    } else if (filePath.endsWith('pending.json')) {
      console.warn(
        'pending.json became unavailable; preserving the last reconciled state'
      )
    }
    // The file may be recreated (or replaced atomically) right away: signal
    // so the consumer keeps retrying until a valid snapshot returns.
    emitSignal(filePath, 'file removal')
  })

  deviceWatcher.on('error', (error) => {
    console.error('Error watching device files:', error)
  })

  console.log(`Watching device files in: ${nodesPath}`)
  return deviceWatcher
}

/**
 * Stop watching device files
 */
export function stopDeviceWatcher(): void {
  if (deviceWatcher) {
    deviceWatcher.close()
    deviceWatcher = null
    console.log('Device watcher stopped')
  }
}

// ============================================
// State
// ============================================

let deviceWatcher: FSWatcher | null = null
