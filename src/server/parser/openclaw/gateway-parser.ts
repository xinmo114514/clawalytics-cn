/**
 * OpenClaw Gateway Log Parser
 *
 * Parses JSON Lines logs from /tmp/openclaw/openclaw-YYYY-MM-DD.log
 * Each line contains token usage, cost, and metadata for API calls.
 */

import { calculateCost } from '../costs.js';

// ============================================
// Interfaces
// ============================================

/**
 * Raw log entry structure from OpenClaw gateway logs
 */
export interface OpenClawLogEntry {
  timestamp: string;
  level: string;           // "INFO", "WARN", "ERROR", "DEBUG"
  subsystem?: string;      // "api", "gateway", "auth", etc.
  message?: string;

  // Model and token data (present for API calls)
  model?: string;          // "anthropic/claude-opus-4-5", "openai/gpt-4o", etc.
  tokens?: {
    input?: number;
    output?: number;
    cache_read?: number;
    cache_write?: number;
  };
  cost?: number;           // USD cost (when available from provider)
  duration_ms?: number;
  context_tokens?: number;

  // Channel/session info
  channel?: string;        // "whatsapp", "telegram", "slack", etc.
  session_id?: string;
  agent_id?: string;

  // Connection events (for security monitoring)
  event?: string;          // "connection", "disconnection", "auth_success", etc.
  device_id?: string;
  ip?: string;
  error?: string;
}

/**
 * Parsed result with normalized data for database storage
 */
export interface ParsedGatewayLogResult {
  timestamp: string;
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  cacheCreationTokens: number;
  cacheReadTokens: number;
  cost: number;
  cacheSavings: number;
  durationMs: number;
  channel: string | null;
  sessionId: string | null;
  agentId: string | null;
  rawEntry: OpenClawLogEntry;
}

/**
 * Connection event for security monitoring
 */
export interface ConnectionEvent {
  timestamp: string;
  event: string;
  deviceId: string | null;
  ip: string | null;
  message: string | null;
  error: string | null;
  level: string;
}

// ============================================
// Parsing Functions
// ============================================

/**
 * Parse a single line from OpenClaw gateway logs
 * Returns token/cost data if present, null otherwise
 */
export function parseGatewayLogLine(line: string): ParsedGatewayLogResult | null {
  if (!line.trim()) {
    return null;
  }

  let entry: OpenClawLogEntry;
  try {
    entry = JSON.parse(line) as OpenClawLogEntry;
  } catch {
    // Not JSON, skip
    return null;
  }

  // Only process entries with token data
  if (!entry.tokens && !entry.model) {
    return null;
  }

  // Extract provider and model from "provider/model" format
  const { provider, model } = parseModelIdentifier(entry.model || 'unknown/unknown');

  // Extract token counts
  const inputTokens = entry.tokens?.input ?? 0;
  const outputTokens = entry.tokens?.output ?? 0;
  const cacheReadTokens = entry.tokens?.cache_read ?? 0;
  const cacheCreationTokens = entry.tokens?.cache_write ?? 0;

  // Skip entries with no tokens
  if (inputTokens === 0 && outputTokens === 0 && cacheReadTokens === 0 && cacheCreationTokens === 0) {
    return null;
  }

  // Always calculate from our pricing data (needed for cache savings)
  const costResult = calculateCost(provider, model, {
    inputTokens,
    outputTokens,
    cacheCreationTokens,
    cacheReadTokens,
  });

  // Use provider cost if available, otherwise our calculated cost
  const cost = (entry.cost && entry.cost > 0) ? entry.cost : costResult.totalCost;
  const cacheSavings = costResult.cacheSavings;

  return {
    timestamp: entry.timestamp || new Date().toISOString(),
    provider,
    model,
    inputTokens,
    outputTokens,
    cacheCreationTokens,
    cacheReadTokens,
    cost,
    cacheSavings,
    durationMs: entry.duration_ms ?? 0,
    channel: entry.channel || null,
    sessionId: entry.session_id || null,
    agentId: entry.agent_id || null,
    rawEntry: entry,
  };
}

/**
 * Parse connection event from gateway logs (for security monitoring)
 */
export function parseConnectionEvent(line: string): ConnectionEvent | null {
  if (!line.trim()) {
    return null;
  }

  let entry: OpenClawLogEntry;
  try {
    entry = JSON.parse(line) as OpenClawLogEntry;
  } catch {
    return null;
  }

  // Only process connection-related events
  if (!entry.event) {
    return null;
  }

  const connectionEvents = ['connection', 'disconnection', 'auth_success', 'auth_failure', 'device_paired', 'device_unpaired'];
  if (!connectionEvents.includes(entry.event)) {
    return null;
  }

  return {
    timestamp: entry.timestamp || new Date().toISOString(),
    event: entry.event,
    deviceId: entry.device_id || null,
    ip: entry.ip || null,
    message: entry.message || null,
    error: entry.error || null,
    level: entry.level || 'INFO',
  };
}

/**
 * Parse model identifier from "provider/model" format
 * Examples:
 *   "anthropic/claude-opus-4-5" -> { provider: "anthropic", model: "claude-opus-4-5" }
 *   "openrouter/anthropic/claude-opus-4-5" -> { provider: "openrouter", model: "anthropic/claude-opus-4-5" }
 *   "gpt-4o" -> { provider: "unknown", model: "gpt-4o" }
 */
export function parseModelIdentifier(modelId: string): { provider: string; model: string } {
  if (!modelId || modelId === 'unknown') {
    return { provider: 'unknown', model: 'unknown' };
  }

  const slashIndex = modelId.indexOf('/');

  if (slashIndex === -1) {
    // No provider prefix, try to infer
    return {
      provider: inferProvider(modelId),
      model: modelId,
    };
  }

  const provider = modelId.substring(0, slashIndex);
  const model = modelId.substring(slashIndex + 1);

  return { provider, model };
}

/**
 * Infer provider from model name when not explicitly provided
 */
function inferProvider(model: string): string {
  const modelLower = model.toLowerCase();

  if (modelLower.includes('claude') || modelLower.includes('anthropic')) {
    return 'anthropic';
  }
  if (modelLower.includes('gpt') || modelLower.includes('o1') || modelLower.includes('davinci')) {
    return 'openai';
  }
  if (modelLower.includes('gemini')) {
    return 'google';
  }
  if (modelLower.includes('moonshot') || modelLower.includes('kimi')) {
    return 'moonshot';
  }
  if (modelLower.includes('deepseek')) {
    return 'deepseek';
  }
  if (modelLower.includes('llama') || modelLower.includes('mistral')) {
    return 'meta';
  }

  return 'unknown';
}

/**
 * Parse multiple log lines and return all valid results
 */
export function parseGatewayLogLines(content: string): ParsedGatewayLogResult[] {
  const lines = content.split('\n');
  const results: ParsedGatewayLogResult[] = [];

  for (const line of lines) {
    const result = parseGatewayLogLine(line);
    if (result) {
      results.push(result);
    }
  }

  return results;
}

// ============================================
// Gateway Log Entry (for security monitoring)
// ============================================

/**
 * Legacy gateway log entry format for security monitoring
 * Used by security-watcher.ts for connection events
 */
export interface GatewayLogEntry {
  timestamp: string;
  level: string;
  event: string;
  deviceId?: string;
  ip?: string;
  message?: string;
  error?: string;
}

// ============================================
// Connection Event Watching (for security)
// ============================================

import fs from 'fs';
import path from 'path';
import chokidar, { FSWatcher } from 'chokidar';

const securityFilePositions = new Map<string, number>();
let securityGatewayWatcher: FSWatcher | null = null;

/**
 * Watch gateway log files for connection events (security monitoring)
 */
export function watchGatewayLogs(
  logsPath: string,
  onEvent: (event: GatewayLogEntry) => void
): FSWatcher | null {
  if (!fs.existsSync(logsPath)) {
    console.log(`Gateway logs path does not exist: ${logsPath}`);
    return null;
  }

  const globPattern = path.join(logsPath, 'openclaw-*.log');

  securityGatewayWatcher = chokidar.watch(globPattern, {
    persistent: true,
    ignoreInitial: false,
    awaitWriteFinish: {
      stabilityThreshold: 100,
      pollInterval: 50,
    },
  });

  securityGatewayWatcher.on('add', (filePath) => {
    processSecurityLogFile(filePath, onEvent);
  });

  securityGatewayWatcher.on('change', (filePath) => {
    processSecurityLogFileChanges(filePath, onEvent);
  });

  securityGatewayWatcher.on('error', (error) => {
    console.error('Error watching gateway logs for security:', error);
  });

  console.log(`Watching gateway logs for security events in: ${logsPath}`);
  return securityGatewayWatcher;
}

/**
 * Stop watching gateway logs for security events
 */
export function stopGatewayWatcher(): void {
  if (securityGatewayWatcher) {
    securityGatewayWatcher.close();
    securityGatewayWatcher = null;
    securityFilePositions.clear();
    console.log('Security gateway watcher stopped');
  }
}

function processSecurityLogFile(
  filePath: string,
  onEvent: (event: GatewayLogEntry) => void
): void {
  try {
    const stats = fs.statSync(filePath);
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');

    for (const line of lines) {
      const event = parseConnectionEvent(line);
      if (event) {
        onEvent({
          timestamp: event.timestamp,
          level: event.level,
          event: event.event,
          deviceId: event.deviceId ?? undefined,
          ip: event.ip ?? undefined,
          message: event.message ?? undefined,
          error: event.error ?? undefined,
        });
      }
    }

    securityFilePositions.set(filePath, stats.size);
  } catch (error) {
    console.error(`Error processing security log ${filePath}:`, error);
  }
}

function processSecurityLogFileChanges(
  filePath: string,
  onEvent: (event: GatewayLogEntry) => void
): void {
  try {
    const stats = fs.statSync(filePath);
    const previousPosition = securityFilePositions.get(filePath) || 0;

    if (stats.size <= previousPosition) {
      if (stats.size < previousPosition) {
        securityFilePositions.set(filePath, 0);
        processSecurityLogFile(filePath, onEvent);
      }
      return;
    }

    const fd = fs.openSync(filePath, 'r');
    const newBytes = stats.size - previousPosition;
    const buffer = Buffer.alloc(newBytes);
    fs.readSync(fd, buffer, 0, newBytes, previousPosition);
    fs.closeSync(fd);

    const newContent = buffer.toString('utf-8');
    const lines = newContent.split('\n');

    for (const line of lines) {
      const event = parseConnectionEvent(line);
      if (event) {
        onEvent({
          timestamp: event.timestamp,
          level: event.level,
          event: event.event,
          deviceId: event.deviceId ?? undefined,
          ip: event.ip ?? undefined,
          message: event.message ?? undefined,
          error: event.error ?? undefined,
        });
      }
    }

    securityFilePositions.set(filePath, stats.size);
  } catch (error) {
    console.error(`Error processing security log changes ${filePath}:`, error);
  }
}
