import { calculateCost, identifyProvider } from './costs.js';
import {
  upsertSession,
  insertRequest,
  upsertDailyCost,
  upsertModelUsage,
  getSession,
  type DailyCostUpdate,
} from '../db/queries.js';

// OpenClaw/Claude Code log entry structure
export interface LogEntry {
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

interface SessionState {
  id: string;
  projectPath: string;
  startedAt: string;
  lastActivity: string;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCost: number;
  modelsUsed: Set<string>;
}

const activeSessions = new Map<string, SessionState>();

export function parseLogLine(line: string, projectPath: string): void {
  if (!line.trim()) return;

  let entry: LogEntry;
  try {
    entry = JSON.parse(line) as LogEntry;
  } catch {
    // Skip non-JSON lines
    return;
  }

  // Extract session ID from various possible fields
  const sessionId = entry.session_id || entry.conversation_id || extractSessionId(projectPath);

  // Get or create session state
  let session = activeSessions.get(sessionId);
  const isNewSession = !session;

  if (!session) {
    // Check if session exists in database
    const existingSession = getSession(sessionId);
    if (existingSession) {
      session = {
        id: sessionId,
        projectPath: existingSession.project_path,
        startedAt: existingSession.started_at,
        lastActivity: existingSession.last_activity,
        totalInputTokens: existingSession.total_input_tokens,
        totalOutputTokens: existingSession.total_output_tokens,
        totalCost: existingSession.total_cost,
        modelsUsed: new Set(existingSession.models_used),
      };
    } else {
      session = {
        id: sessionId,
        projectPath,
        startedAt: entry.timestamp || new Date().toISOString(),
        lastActivity: entry.timestamp || new Date().toISOString(),
        totalInputTokens: 0,
        totalOutputTokens: 0,
        totalCost: 0,
        modelsUsed: new Set(),
      };
    }
    activeSessions.set(sessionId, session);
  }

  // Process based on entry type
  if (hasTokenUsage(entry)) {
    processTokenUsage(entry, session, isNewSession);
  }

  // Update session last activity
  if (entry.timestamp) {
    session.lastActivity = entry.timestamp;
  }
}

function hasTokenUsage(entry: LogEntry): boolean {
  return !!(
    entry.usage?.input_tokens ||
    entry.usage?.output_tokens ||
    entry.message?.usage?.input_tokens ||
    entry.message?.usage?.output_tokens
  );
}

function processTokenUsage(entry: LogEntry, session: SessionState, isNewSession: boolean): void {
  // Extract usage data - check both top-level and message-level usage
  const usage = entry.usage || entry.message?.usage;
  if (!usage) return;

  // Extract tokens separately - cache tokens are NOT added to input tokens
  const inputTokens = usage.input_tokens || 0;
  const outputTokens = usage.output_tokens || 0;
  const cacheCreationTokens = usage.cache_creation_input_tokens || 0;
  const cacheReadTokens = usage.cache_read_input_tokens || 0;

  // Skip if no tokens at all
  if (inputTokens === 0 && outputTokens === 0 && cacheCreationTokens === 0 && cacheReadTokens === 0) return;

  // Get model info
  const model = entry.model || entry.message?.model || 'unknown';
  const provider = identifyProvider(model);

  // Calculate cost for regular tokens
  const costResult = calculateCost(provider, model, {
    inputTokens,
    outputTokens,
    cacheCreationTokens,
    cacheReadTokens,
  });

  // Update session state (track only regular input/output tokens for session totals)
  session.totalInputTokens += inputTokens;
  session.totalOutputTokens += outputTokens;
  session.totalCost += costResult.totalCost;
  session.modelsUsed.add(model);

  const timestamp = entry.timestamp || new Date().toISOString();
  const date = timestamp.split('T')[0];

  // Save to database
  insertRequest({
    session_id: session.id,
    timestamp,
    provider,
    model,
    input_tokens: inputTokens,
    output_tokens: outputTokens,
    cache_creation_tokens: cacheCreationTokens,
    cache_read_tokens: cacheReadTokens,
    cost: costResult.totalCost,
    message_type: entry.type,
    raw_data: JSON.stringify(entry),
  });

  upsertSession({
    id: session.id,
    project_path: session.projectPath,
    started_at: session.startedAt,
    last_activity: session.lastActivity,
    total_input_tokens: session.totalInputTokens,
    total_output_tokens: session.totalOutputTokens,
    total_cost: session.totalCost,
    models_used: Array.from(session.modelsUsed),
  });

  const dailyCostUpdate: DailyCostUpdate = {
    date,
    cost: costResult.totalCost,
    inputTokens,
    outputTokens,
    cacheCreationTokens,
    cacheReadTokens,
    cacheSavings: costResult.cacheSavings,
    isNewSession,
  };
  upsertDailyCost(dailyCostUpdate);
  upsertModelUsage(date, provider, model, inputTokens, outputTokens, costResult.totalCost);
}

function extractSessionId(projectPath: string): string {
  // Extract session ID from project path
  // Typical path: ~/.claude/projects/project-name/session-id.jsonl
  const parts = projectPath.split('/');
  const filename = parts[parts.length - 1];
  return filename.replace('.jsonl', '') || `session-${Date.now()}`;
}

export function clearSessionCache(): void {
  activeSessions.clear();
}
