import fs from 'fs';
import path from 'path';
import os from 'os';
import chokidar, { FSWatcher } from 'chokidar';
import { normalizeOpenClawPath } from '../config/loader.js';
import { loadAgents, watchAgentConfig, type OpenClawAgent } from '../parser/openclaw/agent-loader.js';
import { listSessionFiles, loadSessionIndex, watchSessionIndex, type SessionMetadata } from '../parser/openclaw/session-index.js';
import { parseOpenClawLine, type OpenClawLogEntry } from '../parser/openclaw/session-parser.js';
import { logOutboundCall } from '../db/queries-security.js';
import { broadcastCostsUpdated, broadcastNewSession } from '../ws/index.js';

// Re-export interfaces that routes import from queries.ts
export type {
  DailyCost, ModelUsage, Stats, EnhancedStats, TokenBreakdown,
  PeriodSummary, CostSummary, CacheSavingsDetail, ModelUsageWithCache,
  ModelStats, ModelDailyUsage, ProviderSummary, WeeklyTrend,
  SessionStats, ProjectBreakdown, EnhancedSession, EnhancedSessionsOptions,
  Session, Request,
} from '../db/queries.js';

export type {
  Agent, AgentDailyCost, Channel, ChannelDailyCost,
  AgentStats as AgentStatsResult, ChannelStats as ChannelStatsResult,
} from '../db/queries-agents.js';

// Also re-export outbound call types from queries-security since tools route needs them
export type {
  OutboundCall, OutboundCallFilters, OutboundCallsResult, OutboundCallStats,
} from '../db/queries-security.js';

import type {
  Session, Request, DailyCost, ModelUsage, Stats, EnhancedStats,
  TokenBreakdown, PeriodSummary, CostSummary, CacheSavingsDetail,
  ModelUsageWithCache, ModelStats, ModelDailyUsage, ProviderSummary,
  WeeklyTrend, SessionStats, ProjectBreakdown, EnhancedSession,
  EnhancedSessionsOptions,
} from '../db/queries.js';

import type {
  Agent, AgentDailyCost, Channel, ChannelDailyCost,
  AgentStats as AgentStatsResult, ChannelStats as ChannelStatsResult,
} from '../db/queries-agents.js';

import type {
  OutboundCall, OutboundCallFilters, OutboundCallsResult, OutboundCallStats,
} from '../db/queries-security.js';

// ============================================
// Internal data structures
// ============================================

interface ParsedRequest {
  timestamp: string;
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  cacheCreationTokens: number;
  cacheReadTokens: number;
  cost: number;
  cacheSavings: number;
  messageType: string;
}

interface SessionData {
  id: string;
  agentId: string;
  projectPath: string;
  startedAt: string;
  lastActivity: string;
  channel?: string;
  requests: ParsedRequest[];
  totalCost: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  modelsUsed: Set<string>;
  toolCalls: ToolCallData[];
}

interface ToolCallData {
  sessionId: string;
  agentId: string;
  toolName: string;
  toolUseId: string;
  timestamp: string;
  durationMs: number | null;
  status: string | null;
  error: string | null;
}

interface PendingToolCall {
  sessionId: string;
  agentId: string;
  toolName: string;
  toolUseId: string;
  timestamp: string;
  startTime: number;
}

// ============================================
// AnalyticsService
// ============================================

class AnalyticsService {
  private sessions = new Map<string, SessionData>();
  private agents = new Map<string, OpenClawAgent>();
  private dirty = true;
  private watchers: FSWatcher[] = [];
  private budgetCheckTimeout: ReturnType<typeof setTimeout> | null = null;
  private pendingToolCalls = new Map<string, PendingToolCall>();
  private toolCleanupInterval: ReturnType<typeof setInterval> | null = null;
  private initialized = false;

  // Cached aggregates
  private _dailyCosts: DailyCost[] | null = null;
  private _modelUsage: Map<string, { provider: string; model: string; inputTokens: number; outputTokens: number; cacheReadTokens: number; cacheCreationTokens: number; cost: number; requestCount: number }> | null = null;

  initialize(openClawPath?: string): void {
    console.log('=== AnalyticsService.initialize ===');
    const agentConfigPath = normalizeOpenClawPath(openClawPath) || path.join(os.homedir(), '.openclaw');
    console.log('Using OpenClaw path:', agentConfigPath);

    if (this.initialized) {
      console.log('AnalyticsService already initialized, stopping previous instance...');
      this.shutdown();
    }

    if (!fs.existsSync(agentConfigPath)) {
      console.log(`OpenClaw config path does not exist: ${agentConfigPath}`);
      this.initialized = true;
      return;
    }

    // Load agents
    const agents = loadAgents(agentConfigPath);
    console.log(`Found ${agents.length} agent(s)`);
    for (const agent of agents) {
      console.log(`Loading agent: ${agent.name} (${agent.id})`);
      this.agents.set(agent.id, agent);
      this.loadAgentSessions(agentConfigPath, agent);
    }

    // Watch agent config
    const configWatcher = watchAgentConfig(agentConfigPath, (updatedAgents) => {
      for (const agent of updatedAgents) {
        this.agents.set(agent.id, agent);
        this.loadAgentSessions(agentConfigPath, agent);
      }
    });
    if (configWatcher) this.watchers.push(configWatcher);

    // Tool call cleanup interval
    this.toolCleanupInterval = setInterval(() => {
      this.cleanupStalePendingCalls();
    }, 5 * 60 * 1000);

    this.initialized = true;
    console.log(`AnalyticsService initialized: ${this.sessions.size} sessions parsed`);
  }

  shutdown(): void {
    for (const watcher of this.watchers) {
      watcher.close();
    }
    this.watchers.length = 0;
    if (this.budgetCheckTimeout) {
      clearTimeout(this.budgetCheckTimeout);
      this.budgetCheckTimeout = null;
    }
    if (this.toolCleanupInterval) {
      clearInterval(this.toolCleanupInterval);
      this.toolCleanupInterval = null;
    }
    this.sessions.clear();
    this.agents.clear();
    this.pendingToolCalls.clear();
    this.dirty = true;
    this.initialized = false;
    console.log('AnalyticsService stopped');
  }

  private loadAgentSessions(openClawPath: string, agent: OpenClawAgent): void {
    const agentPath = path.join(openClawPath, 'agents', agent.id);
    console.log(`Checking agent path: ${agentPath}`);
    if (!fs.existsSync(agentPath)) {
      console.log(`Agent path does not exist: ${agentPath}`);
      return;
    }

    // Load session metadata from sessions.json for channel info
    const sessionMetas = loadSessionIndex(agentPath);
    console.log(`Found ${sessionMetas.length} session metadata entries for agent ${agent.id}`);
    const metaBySessionId = new Map<string, SessionMetadata>();
    for (const meta of sessionMetas) {
      metaBySessionId.set(meta.id, meta);
    }

    // Parse all JSONL files
    const files = listSessionFiles(agentPath);
    console.log(`Found ${files.length} session file(s) for agent ${agent.id}`);
    let parsed = 0;

    for (const filePath of files) {
      const fileName = path.basename(filePath, '.jsonl');
      if (fileName.includes('.deleted')) continue;

      // Skip if already loaded
      if (this.sessions.has(fileName)) continue;

      const meta = metaBySessionId.get(fileName);
      this.parseSessionFile(filePath, fileName, agent.id, agent.workspace || agentPath, meta?.channel);
      parsed++;
    }

    if (parsed > 0) {
      this.markDirty();
    }

    const activeFiles = files.filter(f => !path.basename(f).includes('.deleted'));
    console.log(`Agent ${agent.name}: ${activeFiles.length} session files loaded`);

    // Watch for new sessions
    const sessionWatcher = watchSessionIndex(agentPath, (session: SessionMetadata) => {
      if (this.sessions.has(session.id)) return;
      console.log(`New session detected for agent ${agent.name}: ${session.id}`);

      const logPath = path.join(agentPath, 'sessions', `${session.id}.jsonl`);
      this.parseSessionFile(logPath, session.id, agent.id, agent.workspace || agentPath, session.channel);
      this.markDirty();
      broadcastNewSession(session.id);

      // Watch the new file for changes
      this.watchSessionFile(logPath, session.id, agent.id, agent.workspace || agentPath, session.channel);
    });
    if (sessionWatcher) this.watchers.push(sessionWatcher);

    // Watch existing session JSONL files for changes
    for (const filePath of files) {
      const fileName = path.basename(filePath, '.jsonl');
      if (fileName.includes('.deleted')) continue;
      const meta = metaBySessionId.get(fileName);
      this.watchSessionFile(filePath, fileName, agent.id, agent.workspace || agentPath, meta?.channel);
    }
  }

  private watchSessionFile(filePath: string, sessionId: string, agentId: string, projectPath: string, channel?: string): void {
    if (!fs.existsSync(filePath)) return;

    const watcher = chokidar.watch(filePath, {
      persistent: true,
      ignoreInitial: true,
      awaitWriteFinish: { stabilityThreshold: 100, pollInterval: 50 },
    });

    watcher.on('change', () => {
      // Re-parse the entire file (files are small ~10-50KB)
      this.parseSessionFile(filePath, sessionId, agentId, projectPath, channel);
      this.markDirty();
      this.debouncedBudgetCheck();
    });

    this.watchers.push(watcher);
  }

  private parseSessionFile(filePath: string, sessionId: string, agentId: string, projectPath: string, channel?: string): void {
    if (!fs.existsSync(filePath)) {
      console.warn(`Session file does not exist: ${filePath}`);
      return;
    }

    try {
      let content;
      try {
        content = fs.readFileSync(filePath, 'utf-8');
      } catch (readError) {
        console.error(`Error reading session file ${filePath}:`, readError);
        return;
      }

      const lines = content.split('\n');

      const session: SessionData = {
        id: sessionId,
        agentId,
        projectPath,
        startedAt: '',
        lastActivity: '',
        channel,
        requests: [],
        totalCost: 0,
        totalInputTokens: 0,
        totalOutputTokens: 0,
        modelsUsed: new Set(),
        toolCalls: [],
      };

      let parsingErrors = 0;
      for (const line of lines) {
        if (!line.trim()) continue;

        try {
          const result = parseOpenClawLine(line, sessionId, agentId);
          if (result) {
            session.requests.push({
              timestamp: result.timestamp,
              provider: result.provider,
              model: result.model,
              inputTokens: result.inputTokens,
              outputTokens: result.outputTokens,
              cacheCreationTokens: result.cacheCreationTokens,
              cacheReadTokens: result.cacheReadTokens,
              cost: result.cost,
              cacheSavings: result.cacheSavings,
              messageType: result.messageType,
            });
            session.totalCost += result.cost;
            session.totalInputTokens += result.inputTokens;
            session.totalOutputTokens += result.outputTokens;
            if (result.model && result.model !== 'unknown') {
              session.modelsUsed.add(result.model);
            }
            if (!session.startedAt || result.timestamp < session.startedAt) {
              session.startedAt = result.timestamp;
            }
            if (!session.lastActivity || result.timestamp > session.lastActivity) {
              session.lastActivity = result.timestamp;
            }
          }
        } catch (lineError) {
          parsingErrors++;
          console.warn(`Error parsing line in ${filePath}:`, lineError);
          // Continue parsing other lines
        }

        // Track tool calls from content blocks
        try {
          this.processLineForTools(line, sessionId, agentId, session);
        } catch (toolError) {
          console.warn(`Error processing tool call in ${filePath}:`, toolError);
          // Continue processing other lines
        }
      }

      if (parsingErrors > 0) {
        console.warn(`Found ${parsingErrors} parsing errors in ${filePath}, but continued processing`);
      }

      // Fallback timestamps
      if (!session.startedAt) {
        try {
          const stat = fs.statSync(filePath);
          session.startedAt = stat.birthtime.toISOString();
        } catch {
          session.startedAt = new Date().toISOString();
        }
      }
      if (!session.lastActivity) {
        session.lastActivity = session.startedAt;
      }

      this.sessions.set(sessionId, session);
    } catch (error) {
      console.error(`Error parsing session file ${filePath}:`, error);
    }
  }

  private processLineForTools(line: string, sessionId: string, agentId: string, session: SessionData): void {
    let entry: OpenClawLogEntry;
    try {
      entry = JSON.parse(line);
    } catch {
      return;
    }

    // Extract tool_use from content blocks
    const message = entry.message;
    if (message && Array.isArray(message.content)) {
      for (const block of message.content as Array<Record<string, unknown>>) {
        try {
          if (block.type === 'tool_use' && typeof block.name === 'string' && typeof block.id === 'string') {
            const pending: PendingToolCall = {
              sessionId,
              agentId,
              toolName: block.name,
              toolUseId: block.id,
              timestamp: entry.timestamp || new Date().toISOString(),
              startTime: Date.now(),
            };
            this.pendingToolCalls.set(block.id, pending);

            // Also record in session tool calls
            session.toolCalls.push({
              sessionId,
              agentId,
              toolName: block.name,
              toolUseId: block.id,
              timestamp: pending.timestamp,
              durationMs: null,
              status: null,
              error: null,
            });
          }
          if (block.type === 'tool_result' && typeof block.tool_use_id === 'string') {
            const pending = this.pendingToolCalls.get(block.tool_use_id);
            if (pending) {
              const durationMs = Date.now() - pending.startTime;
              const isError = Boolean(block.is_error);

              // Update the tool call in session
              const tc = session.toolCalls.find(t => t.toolUseId === block.tool_use_id);
              if (tc) {
                tc.durationMs = durationMs;
                tc.status = isError ? 'error' : 'success';
                tc.error = isError ? 'Tool execution failed' : null;
              }

              // Log to DB (outbound_calls table persists)
              try {
                logOutboundCall({
                  session_id: sessionId,
                  agent_id: agentId,
                  tool_name: pending.toolName,
                  duration_ms: durationMs,
                  status: isError ? 'error' : 'success',
                  error: isError ? 'Tool execution failed' : null,
                });
              } catch (dbError) {
                console.warn(`Error logging outbound call to database:`, dbError);
                // Continue even if database logging fails
              }

              this.pendingToolCalls.delete(block.tool_use_id);
            }
          }
        } catch (blockError) {
          console.warn(`Error processing tool block in session ${sessionId}:`, blockError);
          // Continue processing other blocks
        }
      }
    }
  }

  private cleanupStalePendingCalls(): void {
    const now = Date.now();
    for (const [id, pending] of this.pendingToolCalls) {
      if (now - pending.startTime > 300000) {
        logOutboundCall({
          session_id: pending.sessionId,
          agent_id: pending.agentId,
          tool_name: pending.toolName,
          duration_ms: now - pending.startTime,
          status: 'timeout',
          error: 'Tool call timed out without result',
        });
        this.pendingToolCalls.delete(id);
      }
    }
  }

  private markDirty(): void {
    this.dirty = true;
    this._dailyCosts = null;
    this._modelUsage = null;
  }

  private debouncedBudgetCheck(): void {
    if (this.budgetCheckTimeout) {
      clearTimeout(this.budgetCheckTimeout);
    }
    this.budgetCheckTimeout = setTimeout(async () => {
      try {
        // Dynamic imports to avoid circular dependency
        const { checkBudgets } = await import('./budget-checker.js');
        const { detectAnomalies } = await import('./anomaly-detector.js');
        checkBudgets();
        detectAnomalies();
      } catch (error) {
        console.error('Error checking budgets/anomalies:', error);
      }
      broadcastCostsUpdated();
    }, 5000);
  }

  // ============================================
  // Helpers
  // ============================================

  private allRequests(): Array<ParsedRequest & { sessionId: string; agentId: string; channel?: string }> {
    const result: Array<ParsedRequest & { sessionId: string; agentId: string; channel?: string }> = [];
    for (const [, session] of this.sessions) {
      for (const req of session.requests) {
        result.push({ ...req, sessionId: session.id, agentId: session.agentId, channel: session.channel });
      }
    }
    return result;
  }

  private dateStr(iso: string): string {
    return iso.split('T')[0];
  }

  private today(): string {
    return new Date().toISOString().split('T')[0];
  }

  private daysAgo(days: number): string {
    const d = new Date();
    d.setDate(d.getDate() - days);
    return d.toISOString().split('T')[0];
  }

  private startOfMonth(): string {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
  }

  private lastMonthStr(): string {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }

  // ============================================
  // Session queries (matching queries.ts)
  // ============================================

  getSession(id: string): Session | undefined {
    const s = this.sessions.get(id);
    if (!s) return undefined;
    return {
      id: s.id,
      project_path: s.projectPath,
      started_at: s.startedAt,
      last_activity: s.lastActivity,
      total_input_tokens: s.totalInputTokens,
      total_output_tokens: s.totalOutputTokens,
      total_cost: s.totalCost,
      models_used: [...s.modelsUsed],
    };
  }

  getSessions(limit = 100, offset = 0): Session[] {
    const all = [...this.sessions.values()]
      .sort((a, b) => b.lastActivity.localeCompare(a.lastActivity));
    return all.slice(offset, offset + limit).map(s => ({
      id: s.id,
      project_path: s.projectPath,
      started_at: s.startedAt,
      last_activity: s.lastActivity,
      total_input_tokens: s.totalInputTokens,
      total_output_tokens: s.totalOutputTokens,
      total_cost: s.totalCost,
      models_used: [...s.modelsUsed],
    }));
  }

  getSessionCount(): number {
    return this.sessions.size;
  }

  getRequests(sessionId: string): Request[] {
    const s = this.sessions.get(sessionId);
    if (!s) return [];
    return s.requests.map((r, i) => ({
      id: i,
      session_id: sessionId,
      timestamp: r.timestamp,
      provider: r.provider,
      model: r.model,
      input_tokens: r.inputTokens,
      output_tokens: r.outputTokens,
      cache_creation_tokens: r.cacheCreationTokens,
      cache_read_tokens: r.cacheReadTokens,
      cost: r.cost,
      message_type: r.messageType,
    }));
  }

  // ============================================
  // Daily cost queries
  // ============================================

  getDailyCosts(days = 30): DailyCost[] {
    const cutoff = this.daysAgo(days);
    const dayMap = new Map<string, DailyCost>();
    const sessionDates = new Map<string, Set<string>>(); // date -> set of session IDs

    for (const [, session] of this.sessions) {
      for (const req of session.requests) {
        const date = this.dateStr(req.timestamp);
        if (date < cutoff) continue;

        let day = dayMap.get(date);
        if (!day) {
          day = {
            date,
            total_cost: 0,
            total_input_tokens: 0,
            total_output_tokens: 0,
            cache_creation_tokens: 0,
            cache_read_tokens: 0,
            cache_savings: 0,
            session_count: 0,
            request_count: 0,
          };
          dayMap.set(date, day);
          sessionDates.set(date, new Set());
        }

        day.total_cost += req.cost;
        day.total_input_tokens += req.inputTokens;
        day.total_output_tokens += req.outputTokens;
        day.cache_creation_tokens += req.cacheCreationTokens;
        day.cache_read_tokens += req.cacheReadTokens;
        day.cache_savings += req.cacheSavings;
        day.request_count++;

        sessionDates.get(date)!.add(session.id);
      }
    }

    // Set session counts
    for (const [date, day] of dayMap) {
      day.session_count = sessionDates.get(date)!.size;
    }

    return [...dayMap.values()].sort((a, b) => a.date.localeCompare(b.date));
  }

  getTodayCost(): number {
    const today = this.today();
    let cost = 0;
    for (const [, session] of this.sessions) {
      for (const req of session.requests) {
        if (this.dateStr(req.timestamp) === today) {
          cost += req.cost;
        }
      }
    }
    return cost;
  }

  getWeekCost(): number {
    const cutoff = this.daysAgo(7);
    let cost = 0;
    for (const [, session] of this.sessions) {
      for (const req of session.requests) {
        if (this.dateStr(req.timestamp) >= cutoff) {
          cost += req.cost;
        }
      }
    }
    return cost;
  }

  getMonthCost(): number {
    const cutoff = this.daysAgo(30);
    let cost = 0;
    for (const [, session] of this.sessions) {
      for (const req of session.requests) {
        if (this.dateStr(req.timestamp) >= cutoff) {
          cost += req.cost;
        }
      }
    }
    return cost;
  }

  // ============================================
  // Model usage queries
  // ============================================

  getModelUsage(days = 30): ModelUsage[] {
    const cutoff = this.daysAgo(days);
    const modelMap = new Map<string, ModelUsage>();

    for (const [, session] of this.sessions) {
      for (const req of session.requests) {
        if (this.dateStr(req.timestamp) < cutoff) continue;
        const key = `${req.provider}/${req.model}`;
        let m = modelMap.get(key);
        if (!m) {
          m = { date: '', provider: req.provider, model: req.model, input_tokens: 0, output_tokens: 0, cost: 0, request_count: 0 };
          modelMap.set(key, m);
        }
        m.input_tokens += req.inputTokens;
        m.output_tokens += req.outputTokens;
        m.cost += req.cost;
        m.request_count++;
      }
    }

    return [...modelMap.values()].sort((a, b) => b.cost - a.cost);
  }

  getModelUsageWithCache(days = 30): ModelUsageWithCache[] {
    const cutoff = this.daysAgo(days);
    const modelMap = new Map<string, ModelUsageWithCache>();

    for (const [, session] of this.sessions) {
      for (const req of session.requests) {
        if (this.dateStr(req.timestamp) < cutoff) continue;
        const key = `${req.provider}/${req.model}`;
        let m = modelMap.get(key);
        if (!m) {
          m = { provider: req.provider, model: req.model, inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheCreationTokens: 0, cost: 0, requestCount: 0 };
          modelMap.set(key, m);
        }
        m.inputTokens += req.inputTokens;
        m.outputTokens += req.outputTokens;
        m.cacheReadTokens += req.cacheReadTokens;
        m.cacheCreationTokens += req.cacheCreationTokens;
        m.cost += req.cost;
        m.requestCount++;
      }
    }

    return [...modelMap.values()].sort((a, b) => b.cost - a.cost);
  }

  // ============================================
  // Stats queries
  // ============================================

  getStats(): Stats {
    const today = this.today();
    let todaySpend = 0, todayInput = 0, todayOutput = 0;
    let weeklySpend = 0, monthlySpend = 0;
    const weekCutoff = this.daysAgo(7);
    const monthCutoff = this.daysAgo(30);

    for (const [, session] of this.sessions) {
      for (const req of session.requests) {
        const date = this.dateStr(req.timestamp);
        if (date === today) {
          todaySpend += req.cost;
          todayInput += req.inputTokens;
          todayOutput += req.outputTokens;
        }
        if (date >= weekCutoff) weeklySpend += req.cost;
        if (date >= monthCutoff) monthlySpend += req.cost;
      }
    }

    return {
      todaySpend,
      weeklySpend,
      monthlySpend,
      totalSessions: this.sessions.size,
      todayTokens: { input: todayInput, output: todayOutput },
    };
  }

  getEnhancedStats(): EnhancedStats {
    const monthStart = this.startOfMonth();
    let totalCost = 0, monthCost = 0;
    let totalInput = 0, totalOutput = 0, totalCacheRead = 0, totalCacheCreation = 0, totalCacheSavings = 0;
    let activeThisMonth = 0;

    for (const [, session] of this.sessions) {
      if (session.lastActivity >= monthStart) activeThisMonth++;

      for (const req of session.requests) {
        totalCost += req.cost;
        totalInput += req.inputTokens;
        totalOutput += req.outputTokens;
        totalCacheRead += req.cacheReadTokens;
        totalCacheCreation += req.cacheCreationTokens;
        totalCacheSavings += req.cacheSavings;
        if (this.dateStr(req.timestamp) >= monthStart) monthCost += req.cost;
      }
    }

    return {
      totalCost,
      monthCost,
      totalTokens: { input: totalInput, output: totalOutput, cacheRead: totalCacheRead, cacheCreation: totalCacheCreation },
      cacheSavings: totalCacheSavings,
      activeSessionsThisMonth: activeThisMonth,
    };
  }

  getTokenBreakdown(days?: number): TokenBreakdown & { total: number } {
    const cutoff = days !== undefined ? this.daysAgo(days) : '';
    let input = 0, output = 0, cacheRead = 0, cacheCreation = 0;

    for (const [, session] of this.sessions) {
      for (const req of session.requests) {
        if (cutoff && this.dateStr(req.timestamp) < cutoff) continue;
        input += req.inputTokens;
        output += req.outputTokens;
        cacheRead += req.cacheReadTokens;
        cacheCreation += req.cacheCreationTokens;
      }
    }

    return { input, output, cacheRead, cacheCreation, total: input + output + cacheRead + cacheCreation };
  }

  // ============================================
  // Cost summary
  // ============================================

  getCostSummary(): CostSummary {
    const today = this.today();
    const monthStart = this.startOfMonth();
    const lastMonthStr = this.lastMonthStr();

    const lifetime: PeriodSummary = { totalCost: 0, inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheCreationTokens: 0, cacheSavings: 0, sessionCount: 0 };
    const thisMonth: PeriodSummary = { totalCost: 0, inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheCreationTokens: 0, cacheSavings: 0, sessionCount: 0 };
    const lastMonth: PeriodSummary = { totalCost: 0, inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheCreationTokens: 0, cacheSavings: 0, sessionCount: 0 };
    const todayPeriod: PeriodSummary = { totalCost: 0, inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheCreationTokens: 0, cacheSavings: 0, sessionCount: 0 };

    // Track unique sessions per period via dates
    const lifetimeSessions = new Set<string>();
    const thisMonthSessions = new Set<string>();
    const lastMonthSessions = new Set<string>();
    const todaySessions = new Set<string>();

    for (const [, session] of this.sessions) {
      for (const req of session.requests) {
        const date = this.dateStr(req.timestamp);
        const ym = date.substring(0, 7);

        // Lifetime
        lifetime.totalCost += req.cost;
        lifetime.inputTokens += req.inputTokens;
        lifetime.outputTokens += req.outputTokens;
        lifetime.cacheReadTokens += req.cacheReadTokens;
        lifetime.cacheCreationTokens += req.cacheCreationTokens;
        lifetime.cacheSavings += req.cacheSavings;
        lifetimeSessions.add(session.id);

        // This month
        if (date >= monthStart) {
          thisMonth.totalCost += req.cost;
          thisMonth.inputTokens += req.inputTokens;
          thisMonth.outputTokens += req.outputTokens;
          thisMonth.cacheReadTokens += req.cacheReadTokens;
          thisMonth.cacheCreationTokens += req.cacheCreationTokens;
          thisMonth.cacheSavings += req.cacheSavings;
          thisMonthSessions.add(session.id);
        }

        // Last month
        if (ym === lastMonthStr) {
          lastMonth.totalCost += req.cost;
          lastMonth.inputTokens += req.inputTokens;
          lastMonth.outputTokens += req.outputTokens;
          lastMonth.cacheReadTokens += req.cacheReadTokens;
          lastMonth.cacheCreationTokens += req.cacheCreationTokens;
          lastMonth.cacheSavings += req.cacheSavings;
          lastMonthSessions.add(session.id);
        }

        // Today
        if (date === today) {
          todayPeriod.totalCost += req.cost;
          todayPeriod.inputTokens += req.inputTokens;
          todayPeriod.outputTokens += req.outputTokens;
          todayPeriod.cacheReadTokens += req.cacheReadTokens;
          todayPeriod.cacheCreationTokens += req.cacheCreationTokens;
          todayPeriod.cacheSavings += req.cacheSavings;
          todaySessions.add(session.id);
        }
      }
    }

    lifetime.sessionCount = lifetimeSessions.size;
    thisMonth.sessionCount = thisMonthSessions.size;
    lastMonth.sessionCount = lastMonthSessions.size;
    todayPeriod.sessionCount = todaySessions.size;

    return { lifetime, thisMonth, lastMonth, today: todayPeriod };
  }

  getCacheSavings(days?: number): CacheSavingsDetail {
    const cutoff = days !== undefined ? this.daysAgo(days) : '';
    let savings = 0, cacheRead = 0, cacheCreation = 0, totalCost = 0;

    for (const [, session] of this.sessions) {
      for (const req of session.requests) {
        if (cutoff && this.dateStr(req.timestamp) < cutoff) continue;
        savings += req.cacheSavings;
        cacheRead += req.cacheReadTokens;
        cacheCreation += req.cacheCreationTokens;
        totalCost += req.cost;
      }
    }

    const potentialCost = totalCost + savings;
    const savingsPercentage = potentialCost > 0 ? (savings / potentialCost) * 100 : 0;

    return {
      totalSavings: savings,
      cacheReadTokens: cacheRead,
      cacheCreationTokens: cacheCreation,
      savingsPercentage: Math.round(savingsPercentage * 100) / 100,
    };
  }

  // ============================================
  // Model stats for Models page
  // ============================================

  getModelStats(days = 30): ModelStats {
    const usage = this.getModelUsage(days);
    const providers = new Set(usage.map(m => m.provider));

    const topModel = usage.length > 0 ? { provider: usage[0].provider, model: usage[0].model, cost: usage[0].cost } : null;

    // Provider summary
    const providerCosts = new Map<string, { cost: number; models: Set<string> }>();
    for (const m of usage) {
      let p = providerCosts.get(m.provider);
      if (!p) { p = { cost: 0, models: new Set() }; providerCosts.set(m.provider, p); }
      p.cost += m.cost;
      p.models.add(m.model);
    }
    let topProvider: { provider: string; cost: number; modelCount: number } | null = null;
    for (const [provider, data] of providerCosts) {
      if (!topProvider || data.cost > topProvider.cost) {
        topProvider = { provider, cost: data.cost, modelCount: data.models.size };
      }
    }

    return {
      totalModels: usage.length,
      totalProviders: providers.size,
      topModel,
      topProvider,
    };
  }

  getModelDailyUsage(days = 30): ModelDailyUsage[] {
    const cutoff = this.daysAgo(days);
    const dayModelMap = new Map<string, ModelDailyUsage>();

    for (const [, session] of this.sessions) {
      for (const req of session.requests) {
        const date = this.dateStr(req.timestamp);
        if (date < cutoff) continue;
        const key = `${date}/${req.provider}/${req.model}`;
        let m = dayModelMap.get(key);
        if (!m) {
          m = { date, provider: req.provider, model: req.model, inputTokens: 0, outputTokens: 0, cost: 0, requestCount: 0 };
          dayModelMap.set(key, m);
        }
        m.inputTokens += req.inputTokens;
        m.outputTokens += req.outputTokens;
        m.cost += req.cost;
        m.requestCount++;
      }
    }

    return [...dayModelMap.values()].sort((a, b) => b.date.localeCompare(a.date) || b.cost - a.cost);
  }

  getProviderSummary(days = 30): ProviderSummary[] {
    const usage = this.getModelUsage(days);
    const providerMap = new Map<string, ProviderSummary>();

    for (const m of usage) {
      let p = providerMap.get(m.provider);
      if (!p) {
        p = { provider: m.provider, totalCost: 0, totalInputTokens: 0, totalOutputTokens: 0, modelCount: 0, requestCount: 0 };
        providerMap.set(m.provider, p);
      }
      p.totalCost += m.cost;
      p.totalInputTokens += m.input_tokens;
      p.totalOutputTokens += m.output_tokens;
      p.modelCount++;
      p.requestCount += m.request_count;
    }

    return [...providerMap.values()].sort((a, b) => b.totalCost - a.totalCost);
  }

  // ============================================
  // Weekly trend
  // ============================================

  getWeeklyTrend(): WeeklyTrend {
    const thisWeekCutoff = this.daysAgo(6);
    const lastWeekStart = this.daysAgo(13);
    const lastWeekEnd = this.daysAgo(7); // exclusive

    let twCost = 0, twTokens = 0, twSessions = new Set<string>();
    let lwCost = 0, lwTokens = 0, lwSessions = new Set<string>();

    for (const [, session] of this.sessions) {
      for (const req of session.requests) {
        const date = this.dateStr(req.timestamp);
        if (date >= thisWeekCutoff) {
          twCost += req.cost;
          twTokens += req.inputTokens + req.outputTokens;
          twSessions.add(session.id);
        } else if (date >= lastWeekStart && date < lastWeekEnd) {
          lwCost += req.cost;
          lwTokens += req.inputTokens + req.outputTokens;
          lwSessions.add(session.id);
        }
      }
    }

    const changePercent = lwCost > 0
      ? Math.round(((twCost - lwCost) / lwCost) * 10000) / 100
      : twCost > 0 ? 100 : 0;

    return {
      thisWeek: { cost: twCost, tokens: twTokens, sessions: twSessions.size },
      lastWeek: { cost: lwCost, tokens: lwTokens, sessions: lwSessions.size },
      changePercent,
    };
  }

  // ============================================
  // Session analytics
  // ============================================

  getSessionStats(): SessionStats {
    const monthStart = this.startOfMonth();
    let totalCost = 0;
    let monthSessions = 0;
    const projectCounts = new Map<string, number>();

    for (const [, session] of this.sessions) {
      totalCost += session.totalCost;
      if (session.lastActivity >= monthStart) monthSessions++;
      projectCounts.set(session.projectPath, (projectCounts.get(session.projectPath) || 0) + 1);
    }

    let mostActiveProject: { project: string; sessionCount: number } | null = null;
    for (const [project, count] of projectCounts) {
      if (!mostActiveProject || count > mostActiveProject.sessionCount) {
        mostActiveProject = { project, sessionCount: count };
      }
    }

    const total = this.sessions.size;
    return {
      totalSessions: total,
      totalSessionsThisMonth: monthSessions,
      totalCost,
      avgCostPerSession: total > 0 ? totalCost / total : 0,
      mostActiveProject,
    };
  }

  getProjectBreakdown(limit = 10): ProjectBreakdown[] {
    const projectMap = new Map<string, ProjectBreakdown>();

    for (const [, session] of this.sessions) {
      let p = projectMap.get(session.projectPath);
      if (!p) {
        p = { project: session.projectPath, totalCost: 0, totalInputTokens: 0, totalOutputTokens: 0, sessionCount: 0 };
        projectMap.set(session.projectPath, p);
      }
      p.totalCost += session.totalCost;
      p.totalInputTokens += session.totalInputTokens;
      p.totalOutputTokens += session.totalOutputTokens;
      p.sessionCount++;
    }

    return [...projectMap.values()].sort((a, b) => b.totalCost - a.totalCost).slice(0, limit);
  }

  getEnhancedSessions(options: EnhancedSessionsOptions = {}): { sessions: EnhancedSession[]; total: number } {
    const {
      limit = 50, offset = 0,
      sortBy = 'last_activity', sortDir = 'desc',
      project, model, search,
    } = options;

    let filtered = [...this.sessions.values()];

    if (project) {
      filtered = filtered.filter(s => s.projectPath === project);
    }
    if (model) {
      filtered = filtered.filter(s => s.modelsUsed.has(model) || [...s.modelsUsed].some(m => m.includes(model)));
    }
    if (search) {
      const q = search.toLowerCase();
      filtered = filtered.filter(s =>
        s.projectPath.toLowerCase().includes(q) ||
        [...s.modelsUsed].some(m => m.toLowerCase().includes(q))
      );
    }

    const total = filtered.length;

    // Sort
    const dir = sortDir === 'asc' ? 1 : -1;
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'total_cost': return (a.totalCost - b.totalCost) * dir;
        case 'total_input_tokens': return (a.totalInputTokens - b.totalInputTokens) * dir;
        case 'total_output_tokens': return (a.totalOutputTokens - b.totalOutputTokens) * dir;
        case 'request_count': return (a.requests.length - b.requests.length) * dir;
        case 'last_activity':
        default:
          return a.lastActivity.localeCompare(b.lastActivity) * dir;
      }
    });

    const page = filtered.slice(offset, offset + limit);

    const sessions: EnhancedSession[] = page.map(s => ({
      id: s.id,
      project_path: s.projectPath,
      started_at: s.startedAt,
      last_activity: s.lastActivity,
      total_input_tokens: s.totalInputTokens,
      total_output_tokens: s.totalOutputTokens,
      total_cost: s.totalCost,
      models_used: [...s.modelsUsed],
      request_count: s.requests.length,
    }));

    return { sessions, total };
  }

  getDistinctProjects(): string[] {
    const projects = new Set<string>();
    for (const [, session] of this.sessions) {
      projects.add(session.projectPath);
    }
    return [...projects].sort();
  }

  getDistinctModels(): string[] {
    const models = new Set<string>();
    for (const [, session] of this.sessions) {
      for (const req of session.requests) {
        models.add(req.model);
      }
    }
    return [...models].sort();
  }

  // ============================================
  // Agent queries (matching queries-agents.ts)
  // ============================================

  getAgents(): Agent[] {
    const agentMap = new Map<string, Agent>();

    for (const [, agent] of this.agents) {
      agentMap.set(agent.id, {
        id: agent.id,
        name: agent.name,
        workspace: agent.workspace || null,
        created_at: new Date().toISOString(),
        total_cost: 0,
        total_input_tokens: 0,
        total_output_tokens: 0,
        session_count: 0,
      });
    }

    for (const [, session] of this.sessions) {
      let a = agentMap.get(session.agentId);
      if (!a) {
        a = {
          id: session.agentId,
          name: session.agentId,
          workspace: null,
          created_at: new Date().toISOString(),
          total_cost: 0,
          total_input_tokens: 0,
          total_output_tokens: 0,
          session_count: 0,
        };
        agentMap.set(session.agentId, a);
      }
      a.total_cost += session.totalCost;
      a.total_input_tokens += session.totalInputTokens;
      a.total_output_tokens += session.totalOutputTokens;
      a.session_count++;
    }

    return [...agentMap.values()].sort((a, b) => b.total_cost - a.total_cost);
  }

  getAgent(id: string): Agent | undefined {
    return this.getAgents().find(a => a.id === id);
  }

  getAgentDailyCosts(agentId: string, days = 30): AgentDailyCost[] {
    const cutoff = this.daysAgo(days);
    const dayMap = new Map<string, AgentDailyCost>();

    for (const [, session] of this.sessions) {
      if (session.agentId !== agentId) continue;
      for (const req of session.requests) {
        const date = this.dateStr(req.timestamp);
        if (date < cutoff) continue;
        let d = dayMap.get(date);
        if (!d) {
          d = { agent_id: agentId, date, total_cost: 0, input_tokens: 0, output_tokens: 0, cache_read_tokens: 0, cache_creation_tokens: 0, request_count: 0 };
          dayMap.set(date, d);
        }
        d.total_cost += req.cost;
        d.input_tokens += req.inputTokens;
        d.output_tokens += req.outputTokens;
        d.cache_read_tokens += req.cacheReadTokens;
        d.cache_creation_tokens += req.cacheCreationTokens;
        d.request_count++;
      }
    }

    return [...dayMap.values()].sort((a, b) => a.date.localeCompare(b.date));
  }

  getAllAgentsDailyCosts(days = 30): AgentDailyCost[] {
    const cutoff = this.daysAgo(days);
    const dayMap = new Map<string, AgentDailyCost>();

    for (const [, session] of this.sessions) {
      for (const req of session.requests) {
        const date = this.dateStr(req.timestamp);
        if (date < cutoff) continue;
        const key = `${session.agentId}/${date}`;
        let d = dayMap.get(key);
        if (!d) {
          d = { agent_id: session.agentId, date, total_cost: 0, input_tokens: 0, output_tokens: 0, cache_read_tokens: 0, cache_creation_tokens: 0, request_count: 0 };
          dayMap.set(key, d);
        }
        d.total_cost += req.cost;
        d.input_tokens += req.inputTokens;
        d.output_tokens += req.outputTokens;
        d.cache_read_tokens += req.cacheReadTokens;
        d.cache_creation_tokens += req.cacheCreationTokens;
        d.request_count++;
      }
    }

    return [...dayMap.values()].sort((a, b) => a.date.localeCompare(b.date));
  }

  getAgentStatsResult(limit = 50): AgentStatsResult {
    const agents = this.getAgents().slice(0, limit);
    let totalCost = 0, totalSessions = 0;
    for (const a of agents) {
      totalCost += a.total_cost;
      totalSessions += a.session_count;
    }
    return { agents, totalCost, totalSessions };
  }

  // ============================================
  // Channel queries (matching queries-agents.ts)
  // ============================================

  getChannels(): Channel[] {
    const channelMap = new Map<string, Channel>();
    let nextId = 1;

    for (const [, session] of this.sessions) {
      const channelName = session.channel || 'default';
      let ch = channelMap.get(channelName);
      if (!ch) {
        ch = { id: nextId++, name: channelName, total_cost: 0, total_input_tokens: 0, total_output_tokens: 0, message_count: 0 };
        channelMap.set(channelName, ch);
      }
      ch.total_cost += session.totalCost;
      ch.total_input_tokens += session.totalInputTokens;
      ch.total_output_tokens += session.totalOutputTokens;
      ch.message_count += session.requests.length;
    }

    return [...channelMap.values()].sort((a, b) => b.total_cost - a.total_cost);
  }

  getChannel(id: number): Channel | undefined {
    return this.getChannels().find(c => c.id === id);
  }

  getChannelByName(name: string): Channel | undefined {
    return this.getChannels().find(c => c.name === name);
  }

  getChannelDailyCosts(channelId: number, days = 30): ChannelDailyCost[] {
    const channel = this.getChannel(channelId);
    if (!channel) return [];
    return this.getChannelDailyCostsByName(channel.name, days, channelId);
  }

  private getChannelDailyCostsByName(channelName: string, days: number, channelId: number): ChannelDailyCost[] {
    const cutoff = this.daysAgo(days);
    const dayMap = new Map<string, ChannelDailyCost>();

    for (const [, session] of this.sessions) {
      if ((session.channel || 'default') !== channelName) continue;
      for (const req of session.requests) {
        const date = this.dateStr(req.timestamp);
        if (date < cutoff) continue;
        let d = dayMap.get(date);
        if (!d) {
          d = { channel_id: channelId, date, total_cost: 0, input_tokens: 0, output_tokens: 0, message_count: 0 };
          dayMap.set(date, d);
        }
        d.total_cost += req.cost;
        d.input_tokens += req.inputTokens;
        d.output_tokens += req.outputTokens;
        d.message_count++;
      }
    }

    return [...dayMap.values()].sort((a, b) => a.date.localeCompare(b.date));
  }

  getAllChannelsDailyCosts(days = 30): ChannelDailyCost[] {
    const channels = this.getChannels();
    const result: ChannelDailyCost[] = [];
    for (const ch of channels) {
      result.push(...this.getChannelDailyCostsByName(ch.name, days, ch.id));
    }
    return result.sort((a, b) => a.date.localeCompare(b.date));
  }

  getChannelStatsResult(limit = 50): ChannelStatsResult {
    const channels = this.getChannels().slice(0, limit);
    let totalCost = 0, totalMessages = 0;
    for (const ch of channels) {
      totalCost += ch.total_cost;
      totalMessages += ch.message_count;
    }
    return { channels, totalCost, totalMessages };
  }
}

// ============================================
// Singleton
// ============================================

let instance: AnalyticsService | null = null;

export function getAnalyticsService(): AnalyticsService {
  if (!instance) {
    instance = new AnalyticsService();
  }
  return instance;
}

export function initializeAnalyticsService(openClawPath?: string): AnalyticsService {
  const service = getAnalyticsService();
  service.initialize(openClawPath);
  return service;
}

export function shutdownAnalyticsService(): void {
  if (instance) {
    instance.shutdown();
    instance = null;
  }
}
