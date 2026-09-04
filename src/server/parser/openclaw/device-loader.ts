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
  devices: Array<{
    id: string
    name: string
    type: string
    pairedAt: string
    publicKey?: string
  }>
}

interface PendingRequestsFile {
  requests: Array<{
    id: string
    deviceName: string
    type: string
    requestedAt: string
  }>
}

export interface DeviceWatcherCallbacks {
  onDevicePaired: (device: PairedDevice) => void
  onDeviceRemoved: (deviceId: string) => void
  onNewRequest: (request: PendingRequest) => void
  onRequestRemoved: (requestId: string) => void
}

// ============================================
// State tracking for change detection
// ============================================

let previousDevices = new Map<string, PairedDevice>()
let previousRequests = new Map<string, PendingRequest>()
let deviceWatcher: FSWatcher | null = null

// ============================================
// Load functions
// ============================================

/**
 * Load paired devices from the paired.json file
 */
export function loadPairedDevices(openClawPath: string): PairedDevice[] {
  const result = loadPairedDevicesSnapshot(openClawPath)
  return result.status === 'ok' ? result.items : []
}

export function loadPairedDevicesSnapshot(
  openClawPath: string
): SnapshotResult<PairedDevice> {
  const filePath = path.join(openClawPath, 'nodes', 'paired.json')

  if (!fs.existsSync(filePath)) {
    return { status: 'missing', items: [] }
  }

  try {
    const content = fs.readFileSync(filePath, 'utf-8')
    const data = JSON.parse(content) as PairedDevicesFile

    if (!data.devices || !Array.isArray(data.devices)) {
      console.warn('paired.json has no devices array')
      return {
        status: 'error',
        items: [],
        error: new Error('paired.json has no devices array'),
      }
    }

    return {
      status: 'ok',
      items: data.devices.map((device) => ({
        id: device.id,
        name: device.name,
        type: device.type,
        pairedAt: device.pairedAt,
        publicKey: device.publicKey,
      })),
    }
  } catch (error) {
    console.error('Failed to load paired devices:', error)
    return {
      status: 'error',
      items: [],
      error: error instanceof Error ? error : new Error(String(error)),
    }
  }
}

/**
 * Load pending pairing requests from the pending.json file
 */
export function loadPendingRequests(openClawPath: string): PendingRequest[] {
  const result = loadPendingRequestsSnapshot(openClawPath)
  return result.status === 'ok' ? result.items : []
}

export function loadPendingRequestsSnapshot(
  openClawPath: string
): SnapshotResult<PendingRequest> {
  const filePath = path.join(openClawPath, 'nodes', 'pending.json')

  if (!fs.existsSync(filePath)) {
    return { status: 'missing', items: [] }
  }

  try {
    const content = fs.readFileSync(filePath, 'utf-8')
    const data = JSON.parse(content) as PendingRequestsFile

    if (!data.requests || !Array.isArray(data.requests)) {
      console.warn('pending.json has no requests array')
      return {
        status: 'error',
        items: [],
        error: new Error('pending.json has no requests array'),
      }
    }

    return {
      status: 'ok',
      items: data.requests.map((request) => ({
        id: request.id,
        deviceName: request.deviceName,
        type: request.type,
        requestedAt: request.requestedAt,
      })),
    }
  } catch (error) {
    console.error('Failed to load pending requests:', error)
    return {
      status: 'error',
      items: [],
      error: error instanceof Error ? error : new Error(String(error)),
    }
  }
}

// ============================================
// Watch functions
// ============================================

/**
 * Watch device pairing files for changes
 */
export function watchDeviceFiles(
  openClawPath: string,
  callbacks: DeviceWatcherCallbacks
): FSWatcher | null {
  const nodesPath = path.join(openClawPath, 'nodes')
  const pairedPath = path.join(nodesPath, 'paired.json')
  const pendingPath = path.join(nodesPath, 'pending.json')

  // Check if the OpenClaw nodes directory exists
  if (!fs.existsSync(nodesPath)) {
    console.log('OpenClaw nodes path does not exist, skipping device watcher')
    return null
  }

  // Initialize state with current files
  const initialDevices = loadPairedDevices(openClawPath)
  previousDevices = new Map(initialDevices.map((d) => [d.id, d]))

  const initialRequests = loadPendingRequests(openClawPath)
  previousRequests = new Map(initialRequests.map((r) => [r.id, r]))

  // Watch both files
  deviceWatcher = chokidar.watch([pairedPath, pendingPath], {
    persistent: true,
    ignoreInitial: true,
    awaitWriteFinish: {
      stabilityThreshold: 100,
      pollInterval: 50,
    },
  })

  deviceWatcher.on('change', (filePath) => {
    if (filePath.endsWith('paired.json')) {
      handlePairedDevicesChange(openClawPath, callbacks)
    } else if (filePath.endsWith('pending.json')) {
      handlePendingRequestsChange(openClawPath, callbacks)
    }
  })

  deviceWatcher.on('add', (filePath) => {
    if (filePath.endsWith('paired.json')) {
      console.log('paired.json created, loading devices...')
      handlePairedDevicesChange(openClawPath, callbacks)
    } else if (filePath.endsWith('pending.json')) {
      console.log('pending.json created, loading requests...')
      handlePendingRequestsChange(openClawPath, callbacks)
    }
  })

  deviceWatcher.on('unlink', (filePath) => {
    if (filePath.endsWith('paired.json')) {
      console.warn(
        'paired.json became unavailable; preserving the last valid device snapshot'
      )
    } else if (filePath.endsWith('pending.json')) {
      console.warn(
        'pending.json became unavailable; preserving the last valid request snapshot'
      )
    }
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
    previousDevices.clear()
    previousRequests.clear()
    console.log('Device watcher stopped')
  }
}

// ============================================
// Change handlers
// ============================================

function handlePairedDevicesChange(
  openClawPath: string,
  callbacks: DeviceWatcherCallbacks
): void {
  const devicesSnapshot = loadPairedDevicesSnapshot(openClawPath)
  if (devicesSnapshot.status !== 'ok') {
    return
  }
  const currentDevices = devicesSnapshot.items
  const currentDevicesMap = new Map(currentDevices.map((d) => [d.id, d]))

  // Detect new devices
  for (const [id, device] of currentDevicesMap) {
    if (!previousDevices.has(id)) {
      console.log(`New device paired: ${device.name}`)
      callbacks.onDevicePaired(device)
    }
  }

  // Detect removed devices
  for (const [id] of previousDevices) {
    if (!currentDevicesMap.has(id)) {
      console.log(`Device removed: ${id}`)
      callbacks.onDeviceRemoved(id)
    }
  }

  previousDevices = currentDevicesMap
}

function handlePendingRequestsChange(
  openClawPath: string,
  callbacks: DeviceWatcherCallbacks
): void {
  const requestsSnapshot = loadPendingRequestsSnapshot(openClawPath)
  if (requestsSnapshot.status !== 'ok') {
    return
  }
  const currentRequests = requestsSnapshot.items
  const currentRequestsMap = new Map(currentRequests.map((r) => [r.id, r]))

  // Detect new requests
  for (const [id, request] of currentRequestsMap) {
    if (!previousRequests.has(id)) {
      console.log(`New pairing request: ${request.deviceName}`)
      callbacks.onNewRequest(request)
    }
  }

  // Detect removed requests (approved/denied)
  for (const [id] of previousRequests) {
    if (!currentRequestsMap.has(id)) {
      console.log(`Pairing request removed: ${id}`)
      callbacks.onRequestRemoved(id)
    }
  }

  previousRequests = currentRequestsMap
}
