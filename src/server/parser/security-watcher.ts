import type { FSWatcher } from 'chokidar';
import {
  watchDeviceFiles,
  stopDeviceWatcher,
  loadPairedDevices,
  loadPendingRequests,
  type PairedDevice,
  type PendingRequest,
} from './openclaw/device-loader.js';
import {
  watchGatewayLogs,
  stopGatewayWatcher,
  type GatewayLogEntry,
} from './openclaw/gateway-parser.js';
import {
  upsertDevice,
  createPairingRequest,
  logConnectionEvent,
  logAudit,
  updateDeviceLastSeen,
  updateDeviceStatus,
  getDevice,
} from '../db/queries-security.js';
import { AlertService } from '../services/alert-service.js';

// ============================================
// Interfaces
// ============================================

export interface SecurityWatcherConfig {
  /** Path to OpenClaw directory (e.g., ~/.openclaw) */
  openClawPath: string;
  /** Path to gateway logs (e.g., /tmp/openclaw) */
  gatewayLogsPath: string;
  /** Enable or disable the security watcher */
  enabled?: boolean;
}

interface ActiveWatchers {
  deviceWatcher: FSWatcher | null;
  gatewayWatcher: FSWatcher | null;
}

// ============================================
// State
// ============================================

let activeWatchers: ActiveWatchers = {
  deviceWatcher: null,
  gatewayWatcher: null,
};

let isRunning = false;

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
    console.log('Security watcher already running');
    return;
  }

  if (config.enabled === false) {
    console.log('Security watcher disabled by config');
    return;
  }

  const alertService = AlertService.getInstance();

  console.log('Starting security watcher...');

  // Load initial state
  loadInitialState(config.openClawPath);

  // Watch device files
  activeWatchers.deviceWatcher = watchDeviceFiles(config.openClawPath, {
    onDevicePaired: (device: PairedDevice) => {
      handleDevicePaired(device, alertService);
    },
    onDeviceRemoved: (deviceId: string) => {
      handleDeviceRemoved(deviceId, alertService);
    },
    onNewRequest: (request: PendingRequest) => {
      handleNewPairingRequest(request, alertService);
    },
    onRequestRemoved: (requestId: string) => {
      handlePairingRequestRemoved(requestId);
    },
  });

  // Watch gateway logs
  activeWatchers.gatewayWatcher = watchGatewayLogs(
    config.gatewayLogsPath,
    (event: GatewayLogEntry) => {
      handleGatewayEvent(event, alertService);
    }
  );

  isRunning = true;
  console.log('Security watcher started');
}

/**
 * Stop the security watcher
 */
export function stopSecurityWatcher(): void {
  if (!isRunning) {
    console.log('Security watcher not running');
    return;
  }

  console.log('Stopping security watcher...');

  stopDeviceWatcher();
  stopGatewayWatcher();

  activeWatchers = {
    deviceWatcher: null,
    gatewayWatcher: null,
  };

  isRunning = false;
  console.log('Security watcher stopped');
}

/**
 * Check if the security watcher is running
 */
export function isSecurityWatcherRunning(): boolean {
  return isRunning;
}

// ============================================
// Initial state loading
// ============================================

function loadInitialState(openClawPath: string): void {
  // Load existing devices
  const devices = loadPairedDevices(openClawPath);
  for (const device of devices) {
    upsertDevice({
      id: device.id,
      name: device.name,
      type: device.type,
      status: 'active',
    });
  }
  console.log(`Loaded ${devices.length} paired devices`);

  // Load existing pending requests
  const requests = loadPendingRequests(openClawPath);
  for (const request of requests) {
    createPairingRequest({
      device_id: request.id,
      device_name: request.deviceName,
    });
  }
  console.log(`Loaded ${requests.length} pending pairing requests`);
}

// ============================================
// Event handlers
// ============================================

function handleDevicePaired(device: PairedDevice, alertService: AlertService): void {
  console.log(`Device paired: ${device.name} (${device.id})`);

  // Upsert device in database
  upsertDevice({
    id: device.id,
    name: device.name,
    type: device.type,
    status: 'active',
  });

  // Log audit entry
  logAudit({
    action: 'device_paired',
    entity_type: 'device',
    entity_id: device.id,
    details: JSON.stringify({
      name: device.name,
      type: device.type,
      pairedAt: device.pairedAt,
    }),
  });

  // Process through alert service
  alertService.processEvent({
    type: 'device_paired',
    deviceId: device.id,
    name: device.name,
    deviceType: device.type,
    pairedAt: device.pairedAt,
  });
}

function handleDeviceRemoved(deviceId: string, alertService: AlertService): void {
  console.log(`Device removed: ${deviceId}`);

  // Get device info before marking as removed
  const device = getDevice(deviceId);

  // Update device status
  updateDeviceStatus(deviceId, 'removed');

  // Log audit entry
  logAudit({
    action: 'device_removed',
    entity_type: 'device',
    entity_id: deviceId,
    details: device ? JSON.stringify({ name: device.name, type: device.type }) : null,
  });

  // Process through alert service
  alertService.processEvent({
    type: 'device_removed',
    deviceId,
    name: device?.name,
  });
}

function handleNewPairingRequest(
  request: PendingRequest,
  alertService: AlertService
): void {
  console.log(`New pairing request: ${request.deviceName} (${request.id})`);

  // Create pairing request in database
  createPairingRequest({
    device_id: request.id,
    device_name: request.deviceName,
  });

  // Log audit entry
  logAudit({
    action: 'pairing_request_created',
    entity_type: 'pairing_request',
    entity_id: request.id,
    details: JSON.stringify({
      deviceName: request.deviceName,
      type: request.type,
      requestedAt: request.requestedAt,
    }),
  });

  // Process through alert service
  alertService.processEvent({
    type: 'pairing_request',
    deviceId: request.id,
    deviceName: request.deviceName,
    deviceType: request.type,
    requestedAt: request.requestedAt,
  });
}

function handlePairingRequestRemoved(requestId: string): void {
  console.log(`Pairing request removed: ${requestId}`);

  // Log audit entry (request was either approved or denied)
  logAudit({
    action: 'pairing_request_resolved',
    entity_type: 'pairing_request',
    entity_id: requestId,
  });
}

function handleGatewayEvent(event: GatewayLogEntry, alertService: AlertService): void {
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
  });

  // Update device last seen if we have a device ID
  if (event.deviceId && (event.event === 'connection' || event.event === 'auth_success')) {
    updateDeviceLastSeen(event.deviceId);
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
    });
  }

  // Process through alert service
  alertService.processEvent(event);
}
