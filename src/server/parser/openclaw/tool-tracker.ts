import { logOutboundCall } from '../../db/queries-security.js';

// ============================================
// Interfaces
// ============================================

export interface ToolUseEvent {
  toolName: string;
  toolUseId: string;
  timestamp: string;
  sessionId: string;
  agentId: string;
}

export interface ToolResultEvent {
  toolUseId: string;
  isError: boolean;
  durationMs?: number;
}

// ============================================
// State tracking for pending tool calls
// ============================================

interface PendingToolCall {
  toolUse: ToolUseEvent;
  startTime: number;
}

const pendingToolCalls = new Map<string, PendingToolCall>();

// ============================================
// Extract functions
// ============================================

/**
 * Extract tool_use event from a log entry
 *
 * Expected log entry format:
 * {
 *   "type": "tool_use",
 *   "tool_use_id": "toolu_xxx",
 *   "name": "Bash",
 *   "timestamp": "2026-02-05T10:00:00.000Z",
 *   "session_id": "session-123",
 *   "agent_id": "agent-456"
 * }
 */
export function extractToolUse(logEntry: unknown): ToolUseEvent | null {
  if (!logEntry || typeof logEntry !== 'object') {
    return null;
  }

  const entry = logEntry as Record<string, unknown>;

  // Check for tool_use type - handle various possible type names
  const type = entry.type;
  if (type !== 'tool_use' && type !== 'assistant' && type !== 'tool_call') {
    return null;
  }

  // For assistant type, check if it has tool_use content
  let toolName: string | undefined;
  let toolUseId: string | undefined;

  if (entry.tool_use_id && entry.name) {
    // Direct tool_use format
    toolUseId = String(entry.tool_use_id);
    toolName = String(entry.name);
  } else if (entry.content && Array.isArray(entry.content)) {
    // Claude API format with content blocks
    const toolUseBlock = (entry.content as unknown[]).find(
      (block) =>
        typeof block === 'object' &&
        block !== null &&
        (block as Record<string, unknown>).type === 'tool_use'
    ) as Record<string, unknown> | undefined;

    if (toolUseBlock) {
      toolUseId = String(toolUseBlock.id);
      toolName = String(toolUseBlock.name);
    }
  }

  if (!toolName || !toolUseId) {
    return null;
  }

  const timestamp = entry.timestamp
    ? String(entry.timestamp)
    : new Date().toISOString();

  const sessionId = entry.session_id
    ? String(entry.session_id)
    : entry.conversation_id
      ? String(entry.conversation_id)
      : 'unknown';

  const agentId = entry.agent_id ? String(entry.agent_id) : 'unknown';

  return {
    toolName,
    toolUseId,
    timestamp,
    sessionId,
    agentId,
  };
}

/**
 * Extract tool_result event from a log entry
 *
 * Expected log entry format:
 * {
 *   "type": "tool_result",
 *   "tool_use_id": "toolu_xxx",
 *   "is_error": false,
 *   "timestamp": "2026-02-05T10:00:01.000Z"
 * }
 */
export function extractToolResult(logEntry: unknown): ToolResultEvent | null {
  if (!logEntry || typeof logEntry !== 'object') {
    return null;
  }

  const entry = logEntry as Record<string, unknown>;

  // Check for tool_result type
  const type = entry.type;
  if (type !== 'tool_result' && type !== 'user') {
    return null;
  }

  let toolUseId: string | undefined;
  let isError = false;

  if (entry.tool_use_id) {
    // Direct tool_result format
    toolUseId = String(entry.tool_use_id);
    isError = Boolean(entry.is_error);
  } else if (entry.content && Array.isArray(entry.content)) {
    // Claude API format with content blocks
    const toolResultBlock = (entry.content as unknown[]).find(
      (block) =>
        typeof block === 'object' &&
        block !== null &&
        (block as Record<string, unknown>).type === 'tool_result'
    ) as Record<string, unknown> | undefined;

    if (toolResultBlock) {
      toolUseId = String(toolResultBlock.tool_use_id);
      isError = Boolean(toolResultBlock.is_error);
    }
  }

  if (!toolUseId) {
    return null;
  }

  return {
    toolUseId,
    isError,
    durationMs: entry.duration_ms ? Number(entry.duration_ms) : undefined,
  };
}

// ============================================
// Tracking functions
// ============================================

/**
 * Track a tool call (both use and result)
 *
 * If only toolUse is provided, the call is stored as pending.
 * If toolResult is provided, the call is completed and logged to the database.
 */
export function trackToolCall(
  toolUse: ToolUseEvent,
  toolResult?: ToolResultEvent
): void {
  if (!toolResult) {
    // Store as pending, waiting for result
    pendingToolCalls.set(toolUse.toolUseId, {
      toolUse,
      startTime: Date.now(),
    });
    return;
  }

  // Calculate duration if not provided
  let durationMs = toolResult.durationMs;
  const pending = pendingToolCalls.get(toolUse.toolUseId);
  if (!durationMs && pending) {
    durationMs = Date.now() - pending.startTime;
  }

  // Log to database
  logOutboundCall({
    session_id: toolUse.sessionId,
    agent_id: toolUse.agentId,
    tool_name: toolUse.toolName,
    duration_ms: durationMs ?? null,
    status: toolResult.isError ? 'error' : 'success',
    error: toolResult.isError ? 'Tool execution failed' : null,
  });

  // Remove from pending
  pendingToolCalls.delete(toolUse.toolUseId);
}

/**
 * Complete a pending tool call with a result
 */
export function completeToolCall(toolResult: ToolResultEvent): boolean {
  const pending = pendingToolCalls.get(toolResult.toolUseId);
  if (!pending) {
    // No matching pending call found
    return false;
  }

  trackToolCall(pending.toolUse, toolResult);
  return true;
}

/**
 * Process a log entry for tool tracking
 * Handles both tool_use and tool_result entries
 */
export function processLogEntryForTools(logEntry: unknown): void {
  // Try to extract tool_use
  const toolUse = extractToolUse(logEntry);
  if (toolUse) {
    trackToolCall(toolUse);
    return;
  }

  // Try to extract tool_result
  const toolResult = extractToolResult(logEntry);
  if (toolResult) {
    completeToolCall(toolResult);
  }
}

/**
 * Get pending tool calls (for debugging/monitoring)
 */
export function getPendingToolCalls(): Map<string, PendingToolCall> {
  return new Map(pendingToolCalls);
}

/**
 * Clear all pending tool calls
 */
export function clearPendingToolCalls(): void {
  pendingToolCalls.clear();
}

/**
 * Clean up stale pending tool calls (older than threshold)
 */
export function cleanupStalePendingCalls(maxAgeMs = 300000): number {
  const now = Date.now();
  let cleaned = 0;

  for (const [id, pending] of pendingToolCalls) {
    if (now - pending.startTime > maxAgeMs) {
      // Log as incomplete/timeout
      logOutboundCall({
        session_id: pending.toolUse.sessionId,
        agent_id: pending.toolUse.agentId,
        tool_name: pending.toolUse.toolName,
        duration_ms: now - pending.startTime,
        status: 'timeout',
        error: 'Tool call timed out without result',
      });
      pendingToolCalls.delete(id);
      cleaned++;
    }
  }

  return cleaned;
}
