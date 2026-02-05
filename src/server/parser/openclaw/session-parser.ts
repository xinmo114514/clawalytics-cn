import { calculateCost, identifyProvider } from '../costs.js';

/**
 * OpenClaw log entry structure - similar to Claude Code but with origin data
 */
export interface OpenClawLogEntry {
  type: string;
  timestamp?: string;
  message?: {
    role?: string;
    content?: unknown;
    model?: string;
    usage?: {
      input_tokens?: number;
      output_tokens?: number;
      cache_creation_input_tokens?: number;
      cache_read_input_tokens?: number;
    };
  };
  // OpenClaw-specific: origin data for multi-channel support
  origin?: {
    provider?: string; // "whatsapp", "telegram", "slack", "web"
    channel?: string; // channel/group name
    user?: string;
  };
  // Tool use events
  tool_use?: {
    name: string;
    id: string;
  };
  tool_result?: {
    tool_use_id: string;
    is_error?: boolean;
  };
  // Standard fields
  request_id?: string;
  conversation_id?: string;
  session_id?: string;
  model?: string;
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
    cache_creation_input_tokens?: number;
    cache_read_input_tokens?: number;
  };
  [key: string]: unknown;
}

/** Simple tool use info extracted from a log entry (for inline parsing) */
export interface SessionToolUseInfo {
  name: string;
  id: string;
  isError?: boolean;
}

export interface OriginInfo {
  provider: string;
  channel: string;
}

export interface ParsedOpenClawResult {
  sessionId: string;
  agentId: string;
  timestamp: string;
  model: string;
  provider: string;
  inputTokens: number;
  outputTokens: number;
  cacheCreationTokens: number;
  cacheReadTokens: number;
  cost: number;
  cacheSavings: number;
  origin: OriginInfo | null;
  toolUse: SessionToolUseInfo | null;
  messageType: string;
  rawEntry: OpenClawLogEntry;
}

/**
 * Parse a single line from an OpenClaw session log file
 */
export function parseOpenClawLine(
  line: string,
  sessionId: string,
  agentId: string
): ParsedOpenClawResult | null {
  if (!line.trim()) return null;

  let entry: OpenClawLogEntry;
  try {
    entry = JSON.parse(line) as OpenClawLogEntry;
  } catch {
    // Skip non-JSON lines
    return null;
  }

  // Check if this entry has token usage
  if (!hasTokenUsage(entry)) {
    return null;
  }

  // Extract usage data
  const usage = entry.usage || entry.message?.usage;
  if (!usage) return null;

  const inputTokens = usage.input_tokens || 0;
  const outputTokens = usage.output_tokens || 0;
  const cacheCreationTokens = usage.cache_creation_input_tokens || 0;
  const cacheReadTokens = usage.cache_read_input_tokens || 0;

  // Skip if no tokens at all
  if (inputTokens === 0 && outputTokens === 0 && cacheCreationTokens === 0 && cacheReadTokens === 0) {
    return null;
  }

  // Get model info
  const model = entry.model || entry.message?.model || 'unknown';
  const provider = identifyProvider(model);

  // Calculate cost
  const costResult = calculateCost(provider, model, {
    inputTokens,
    outputTokens,
    cacheCreationTokens,
    cacheReadTokens,
  });

  const timestamp = entry.timestamp || new Date().toISOString();

  return {
    sessionId,
    agentId,
    timestamp,
    model,
    provider,
    inputTokens,
    outputTokens,
    cacheCreationTokens,
    cacheReadTokens,
    cost: costResult.totalCost,
    cacheSavings: costResult.cacheSavings,
    origin: extractOrigin(entry),
    toolUse: extractSessionToolUse(entry),
    messageType: entry.type,
    rawEntry: entry,
  };
}

/**
 * Check if entry has token usage data
 */
function hasTokenUsage(entry: OpenClawLogEntry): boolean {
  return !!(
    entry.usage?.input_tokens ||
    entry.usage?.output_tokens ||
    entry.message?.usage?.input_tokens ||
    entry.message?.usage?.output_tokens
  );
}

/**
 * Extract origin information from an OpenClaw log entry
 */
export function extractOrigin(entry: OpenClawLogEntry): OriginInfo | null {
  if (!entry.origin) return null;

  const provider = entry.origin.provider || 'unknown';
  const channel = entry.origin.channel || 'default';

  return { provider, channel };
}

/**
 * Extract simple tool use info from an OpenClaw log entry
 * Note: For full tool tracking, use tool-tracker.ts functions instead
 */
export function extractSessionToolUse(entry: OpenClawLogEntry): SessionToolUseInfo | null {
  if (entry.tool_use) {
    return {
      name: entry.tool_use.name,
      id: entry.tool_use.id,
    };
  }

  if (entry.tool_result) {
    return {
      name: 'tool_result',
      id: entry.tool_result.tool_use_id,
      isError: entry.tool_result.is_error,
    };
  }

  return null;
}
