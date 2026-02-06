import { calculateCost, identifyProvider } from '../costs.js';

/**
 * Actual OpenClaw session JSONL entry structure.
 *
 * Assistant messages look like:
 * {
 *   "type": "message",
 *   "id": "...",
 *   "parentId": "...",
 *   "timestamp": "2026-02-06T11:10:30.498Z",
 *   "message": {
 *     "role": "assistant",
 *     "content": [...],
 *     "api": "anthropic-messages",
 *     "provider": "kimi-coding",
 *     "model": "k2p5",
 *     "usage": {
 *       "input": 8794,
 *       "output": 155,
 *       "cacheRead": 0,
 *       "cacheWrite": 0,
 *       "totalTokens": 8949,
 *       "cost": { "input": 0, "output": 0, "cacheRead": 0, "cacheWrite": 0, "total": 0 }
 *     },
 *     "stopReason": "stop",
 *     "timestamp": 1770376226651
 *   }
 * }
 */
export interface OpenClawLogEntry {
  type: string;
  id?: string;
  parentId?: string | null;
  timestamp?: string;
  message?: {
    role?: string;
    content?: unknown;
    api?: string;
    provider?: string;
    model?: string;
    usage?: {
      // Actual OpenClaw format
      input?: number;
      output?: number;
      cacheRead?: number;
      cacheWrite?: number;
      totalTokens?: number;
      cost?: {
        input?: number;
        output?: number;
        cacheRead?: number;
        cacheWrite?: number;
        total?: number;
      };
      // Claude Code / legacy format
      input_tokens?: number;
      output_tokens?: number;
      cache_creation_input_tokens?: number;
      cache_read_input_tokens?: number;
    };
    stopReason?: string;
    timestamp?: number;
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
 * Parse a single line from an OpenClaw session JSONL file.
 * Handles both actual OpenClaw format (usage.input/output/cacheRead/cacheWrite)
 * and Claude Code format (usage.input_tokens/output_tokens/cache_*).
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
    return null;
  }

  // Only process message entries with assistant role that have usage
  if (entry.type !== 'message') return null;
  if (!entry.message?.usage) return null;
  if (entry.message.role !== 'assistant') return null;

  const usage = entry.message.usage;

  // Extract tokens - support both OpenClaw and Claude Code formats
  const inputTokens = usage.input ?? usage.input_tokens ?? 0;
  const outputTokens = usage.output ?? usage.output_tokens ?? 0;
  const cacheReadTokens = usage.cacheRead ?? usage.cache_read_input_tokens ?? 0;
  const cacheCreationTokens = usage.cacheWrite ?? usage.cache_creation_input_tokens ?? 0;

  // Skip if no tokens at all
  if (inputTokens === 0 && outputTokens === 0 && cacheReadTokens === 0 && cacheCreationTokens === 0) {
    return null;
  }

  // Get model and provider info
  const model = entry.message.model || 'unknown';
  const provider = entry.message.provider || identifyProvider(model);

  // Calculate cost from our pricing data
  const costResult = calculateCost(provider, model, {
    inputTokens,
    outputTokens,
    cacheCreationTokens,
    cacheReadTokens,
  });

  // Use provider-reported cost if available, otherwise our calculated cost
  const providerCost = usage.cost?.total;
  const cost = (providerCost && providerCost > 0) ? providerCost : costResult.totalCost;
  const cacheSavings = costResult.cacheSavings;

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
    cost,
    cacheSavings,
    origin: null,
    toolUse: extractSessionToolUse(entry),
    messageType: entry.type,
    rawEntry: entry,
  };
}

/**
 * Extract simple tool use info from an OpenClaw log entry
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

// Keep legacy export for backwards compatibility
export function extractOrigin(_entry: OpenClawLogEntry): OriginInfo | null {
  return null;
}
