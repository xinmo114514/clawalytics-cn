import fs from 'fs';
import path from 'path';
import chokidar, { FSWatcher } from 'chokidar';

// ============================================
// Interfaces
// ============================================

export interface GatewayLogEntry {
  timestamp: string;
  level: string; // "INFO", "WARN", "ERROR"
  event: string; // "connection", "disconnection", "auth_success", "auth_failure"
  deviceId?: string;
  ip?: string;
  message?: string;
  error?: string;
}

// ============================================
// State tracking
// ============================================

const filePositions = new Map<string, number>();
let gatewayWatcher: FSWatcher | null = null;

// ============================================
// Log line parsing
// ============================================

/**
 * Parse a single gateway log line
 * Format: 2026-02-05T10:00:00.000Z INFO [connection] device=abc123 ip=192.168.1.100 Connected successfully
 */
export function parseGatewayLogLine(line: string): GatewayLogEntry | null {
  if (!line.trim()) {
    return null;
  }

  // Match the log format: TIMESTAMP LEVEL [EVENT] key=value... message
  const logPattern = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z)\s+(INFO|WARN|ERROR)\s+\[(\w+)\]\s*(.*)$/;
  const match = line.match(logPattern);

  if (!match) {
    return null;
  }

  const [, timestamp, level, event, rest] = match;

  const entry: GatewayLogEntry = {
    timestamp,
    level,
    event,
  };

  // Parse key=value pairs and remaining message
  const keyValuePattern = /(\w+)=([\S]+)/g;
  let keyValueMatch;
  let lastIndex = 0;

  while ((keyValueMatch = keyValuePattern.exec(rest)) !== null) {
    const [fullMatch, key, value] = keyValueMatch;
    lastIndex = keyValuePattern.lastIndex;

    switch (key) {
      case 'device':
        entry.deviceId = value;
        break;
      case 'ip':
        entry.ip = value;
        break;
      case 'error':
        entry.error = value;
        break;
      default:
        // Capture other key-value pairs in message if needed
        break;
    }
  }

  // Remaining text after key=value pairs is the message
  const messageStart = rest.lastIndexOf('=');
  if (messageStart !== -1) {
    // Find the end of the last key=value pair
    const afterLastValue = rest.substring(lastIndex).trim();
    if (afterLastValue) {
      entry.message = afterLastValue;
    }
  } else if (rest.trim()) {
    entry.message = rest.trim();
  }

  return entry;
}

/**
 * Parse an entire gateway log file
 */
export function parseGatewayLog(logPath: string): GatewayLogEntry[] {
  if (!fs.existsSync(logPath)) {
    return [];
  }

  try {
    const content = fs.readFileSync(logPath, 'utf-8');
    const lines = content.split('\n');
    const entries: GatewayLogEntry[] = [];

    for (const line of lines) {
      const entry = parseGatewayLogLine(line);
      if (entry) {
        entries.push(entry);
      }
    }

    return entries;
  } catch (error) {
    console.error(`Failed to parse gateway log ${logPath}:`, error);
    return [];
  }
}

// ============================================
// Watch functions
// ============================================

/**
 * Watch gateway log files for new events
 */
export function watchGatewayLogs(
  logsPath: string,
  onEvent: (event: GatewayLogEntry) => void
): FSWatcher | null {
  if (!fs.existsSync(logsPath)) {
    console.log(`Gateway logs path does not exist: ${logsPath}`);
    return null;
  }

  // Watch for openclaw-*.log files
  const globPattern = path.join(logsPath, 'openclaw-*.log');

  gatewayWatcher = chokidar.watch(globPattern, {
    persistent: true,
    ignoreInitial: false,
    awaitWriteFinish: {
      stabilityThreshold: 100,
      pollInterval: 50,
    },
  });

  gatewayWatcher.on('add', (filePath) => {
    console.log(`New gateway log detected: ${filePath}`);
    processExistingLogFile(filePath, onEvent);
  });

  gatewayWatcher.on('change', (filePath) => {
    processLogFileChanges(filePath, onEvent);
  });

  gatewayWatcher.on('error', (error) => {
    console.error('Error watching gateway logs:', error);
  });

  console.log(`Watching gateway logs in: ${logsPath}`);
  return gatewayWatcher;
}

/**
 * Stop watching gateway logs
 */
export function stopGatewayWatcher(): void {
  if (gatewayWatcher) {
    gatewayWatcher.close();
    gatewayWatcher = null;
    filePositions.clear();
    console.log('Gateway watcher stopped');
  }
}

// ============================================
// File processing
// ============================================

function processExistingLogFile(
  filePath: string,
  onEvent: (event: GatewayLogEntry) => void
): void {
  try {
    const stats = fs.statSync(filePath);
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');

    for (const line of lines) {
      const entry = parseGatewayLogLine(line);
      if (entry) {
        onEvent(entry);
      }
    }

    // Track file position for incremental reads
    filePositions.set(filePath, stats.size);
  } catch (error) {
    console.error(`Error processing gateway log ${filePath}:`, error);
  }
}

function processLogFileChanges(
  filePath: string,
  onEvent: (event: GatewayLogEntry) => void
): void {
  try {
    const stats = fs.statSync(filePath);
    const previousPosition = filePositions.get(filePath) || 0;

    if (stats.size <= previousPosition) {
      // File was truncated or hasn't grown
      if (stats.size < previousPosition) {
        // File was truncated, re-read from beginning
        filePositions.set(filePath, 0);
        processExistingLogFile(filePath, onEvent);
      }
      return;
    }

    // Read only the new content
    const fd = fs.openSync(filePath, 'r');
    const newBytes = stats.size - previousPosition;
    const buffer = Buffer.alloc(newBytes);
    fs.readSync(fd, buffer, 0, newBytes, previousPosition);
    fs.closeSync(fd);

    const newContent = buffer.toString('utf-8');
    const lines = newContent.split('\n');

    for (const line of lines) {
      const entry = parseGatewayLogLine(line);
      if (entry) {
        onEvent(entry);
      }
    }

    filePositions.set(filePath, stats.size);
  } catch (error) {
    console.error(`Error processing gateway log changes ${filePath}:`, error);
  }
}

/**
 * Get file positions for testing/debugging
 */
export function getFilePositions(): Map<string, number> {
  return new Map(filePositions);
}

/**
 * Clear file positions (useful for testing)
 */
export function clearFilePositions(): void {
  filePositions.clear();
}
