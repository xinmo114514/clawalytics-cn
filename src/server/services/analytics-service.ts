import path from 'path'
import chokidar, { type FSWatcher } from 'chokidar'
import fs, { type Stats as FsStats } from 'fs'
import os from 'os'
import readline from 'readline'
import { getConfigDir, normalizeOpenClawPath } from '../config/loader.js'
import type {
  Agent,
  AgentDailyCost,
  Channel,
  ChannelDailyCost,
  AgentStats as AgentStatsResult,
  ChannelStats as ChannelStatsResult,
} from '../db/queries-agents.js'
import {
  logOutboundCall,
  logOutboundCalls,
  type OutboundCallInput,
} from '../db/queries-security.js'
import type {
  Session,
  Request,
  DailyCost,
  ModelUsage,
  Stats,
  EnhancedStats,
  TokenBreakdown,
  TokenPeriodSummary,
  TokenSummary,
  PeriodSummary,
  CostSummary,
  CacheSavingsDetail,
  ModelUsageWithCache,
  ModelStats,
  ModelDailyUsage,
  ProviderSummary,
  WeeklyTrend,
  SessionStats,
  ProjectBreakdown,
  EnhancedSession,
  EnhancedSessionsOptions,
} from '../db/queries.js'
import {
  getOpenClawAgentDatabasePath,
  openAgentDatabaseReader,
} from '../parser/openclaw/agent-database.js'
import {
  loadAgents,
  watchAgentConfig,
  type OpenClawAgent,
} from '../parser/openclaw/agent-loader.js'
import {
  getSessionIdFromFileName,
  isActiveSessionTranscriptFileName,
  isSessionTranscriptFileName,
  listSessionFiles,
  loadSessionIndex,
  watchSessionIndex,
  type SessionMetadata,
} from '../parser/openclaw/session-index.js'
import {
  parseOpenClawEntry,
  type OpenClawLogEntry,
  type ParsedOpenClawResult,
} from '../parser/openclaw/session-parser.js'
import { broadcastCostsUpdated, broadcastNewSession } from '../ws/index.js'

const isProduction = process.env.NODE_ENV === 'production'

// Bumped to 2: per-request costs are now derived differently (a reported
// `usage.cost.total` of 0 no longer overrides local pricing) and the built-in
// pricing table gained entries that were previously unpriced. Cached entries
// hold already-parsed records and are only invalidated by mtime/size, so the
// old cache has to be discarded wholesale to avoid stale costs.
// Bump this whenever the parser's cost/token output or the default pricing
// table changes, otherwise historical files keep their cached values forever.
const SESSION_CACHE_VERSION = 2
const SESSION_CACHE_FILE = 'analytics-session-cache-v1.json'
// Trailing-edge debounce for watcher-triggered refreshes. 2s merges bursts of
// SQLite/JSONL writes (agent turns write many events in quick succession)
// into a single incremental rescan.
const BACKGROUND_SESSION_REFRESH_DELAY_MS = 2000
const BACKGROUND_SESSION_REFRESH_YIELD_EVERY = 10
const CACHE_SAVE_DEBOUNCE_MS = 1000
// Incremental SQLite reads page through transcript_events so the event loop
// can breathe between chunks instead of blocking on one huge query.
const DB_EVENTS_PAGE_SIZE = 500
// parseSessionFile yields to the event loop every N lines.
const PARSE_YIELD_LINES = 200

// Re-export interfaces that routes import from queries.ts
export type {
  DailyCost,
  ModelUsage,
  Stats,
  EnhancedStats,
  TokenBreakdown,
  TokenPeriodSummary,
  TokenSummary,
  PeriodSummary,
  CostSummary,
  CacheSavingsDetail,
  ModelUsageWithCache,
  ModelStats,
  ModelDailyUsage,
  ProviderSummary,
  WeeklyTrend,
  SessionStats,
  ProjectBreakdown,
  EnhancedSession,
  EnhancedSessionsOptions,
  Session,
  Request,
} from '../db/queries.js'

export type {
  Agent,
  AgentDailyCost,
  Channel,
  ChannelDailyCost,
  AgentStats as AgentStatsResult,
  ChannelStats as ChannelStatsResult,
} from '../db/queries-agents.js'

// Also re-export outbound call types from queries-security since tools route needs them
export type {
  OutboundCall,
  OutboundCallFilters,
  OutboundCallsResult,
  OutboundCallStats,
} from '../db/queries-security.js'

// ============================================
// Internal data structures
// ============================================

interface ParsedRequest {
  timestamp: string
  provider: string
  model: string
  inputTokens: number
  outputTokens: number
  cacheCreationTokens: number
  cacheReadTokens: number
  cost: number
  cacheSavings: number
  messageType: string
}

interface SessionData {
  id: string
  agentId: string
  projectPath: string
  startedAt: string
  lastActivity: string
  channel?: string
  requests: ParsedRequest[]
  totalCost: number
  totalInputTokens: number
  totalOutputTokens: number
  modelsUsed: Set<string>
  toolCalls: ToolCallData[]
}

interface ToolCallData {
  sessionId: string
  agentId: string
  toolName: string
  toolUseId: string
  timestamp: string
  durationMs: number | null
  status: string | null
  error: string | null
}

interface PendingToolCall {
  sessionId: string
  agentId: string
  toolName: string
  toolUseId: string
  timestamp: string
  startTime: number
}

interface SerializedSessionData {
  id: string
  agentId: string
  projectPath: string
  startedAt: string
  lastActivity: string
  channel?: string
  requests: ParsedRequest[]
  totalCost: number
  totalInputTokens: number
  totalOutputTokens: number
  modelsUsed: string[]
  toolCalls: ToolCallData[]
}

interface CachedSessionEntry {
  filePath: string
  sessionId: string
  agentId: string
  projectPath: string
  channel?: string
  size: number
  mtimeMs: number
  parsedAt: string
  pricingRevision?: number
  session: SerializedSessionData
  // Only set for canonical SQLite-backed sessions: the highest transcript
  // event seq already reflected in `session`. Persisted so a restart can
  // resume from the incremental checkpoint instead of re-reading the whole
  // database. JSONL-backed entries leave it undefined.
  lastSeq?: number
}

interface SessionCacheFile {
  version: number
  openClawPath: string
  entries: CachedSessionEntry[]
}

interface ParseSessionFileOptions {
  fileStat?: FsStats
  updateCache?: boolean
}

// ============================================
// AnalyticsService
// ============================================

interface AggregatedStats {
  todaySpend: number
  todayInput: number
  todayOutput: number
  weekSpend: number
  monthSpend: number
  totalCost: number
  totalInput: number
  totalOutput: number
  totalCacheRead: number
  totalCacheCreation: number
  totalCacheSavings: number
  activeThisMonth: number
}

export type AnalyticsStatus = 'scanning' | 'ready' | 'unavailable' | 'error'

export interface AnalyticsStatusResponse {
  status: AnalyticsStatus
  hasData: boolean
  timestamp: string
  lastScanStartedAt?: string
  lastScanCompletedAt?: string
  lastScanError?: {
    code: 'INITIAL_SCAN_FAILED' | 'SCAN_FAILED'
    message: string
  }
}

class AnalyticsService {
  private sessions = new Map<string, SessionData>()
  private agents = new Map<string, OpenClawAgent>()
  private sessionCache = new Map<string, CachedSessionEntry>()
  private sessionFileKeys = new Map<string, string>()
  private watchers: FSWatcher[] = []
  private budgetCheckTimeout: ReturnType<typeof setTimeout> | null = null
  private backgroundRefreshTimer: ReturnType<typeof setTimeout> | null = null
  private backgroundRefreshPromise: Promise<void> | null = null
  private queuedBackgroundRefresh: {
    openClawPath: string
    agents: OpenClawAgent[]
    generation: number
  } | null = null
  private cacheSaveTimer: ReturnType<typeof setTimeout> | null = null
  private pendingToolCalls = new Map<string, PendingToolCall>()
  private toolCleanupInterval: ReturnType<typeof setInterval> | null = null
  private initialized = false
  private refreshGeneration = 0
  private activeOpenClawPath = ''
  private analyticsStatus: AnalyticsStatus = 'unavailable'
  private lastScanStartedAt: string | undefined
  private lastScanCompletedAt: string | undefined
  private lastScanError: AnalyticsStatusResponse['lastScanError']
  private hasCompletedScan = false
  // Incremental read checkpoints for canonical SQLite sessions.
  // Key: getDatabaseSessionKey(databasePath, sessionId) -> last consumed seq.
  private dbSeqCheckpoints = new Map<string, number>()
  // Files currently being parsed asynchronously; prevents concurrent parses
  // of the same transcript now that parseSessionFile yields between chunks.
  private parsingFiles = new Set<string>()

  // Cached aggregates
  private _dailyCosts: Map<string, DailyCost> | null = null
  private _modelUsage: Map<string, Map<string, ModelUsage>> | null = null
  private _statsCache: AggregatedStats | null = null
  private _statsCacheDate: string = ''
  // Cache-file persistence state (async, deduplicated writes)
  private lastCachePayload: string | null = null
  private cacheSaveInFlight = false
  private cacheSavePending = false
  private cacheSaveCompletion: Promise<void> = Promise.resolve()
  private pricingRevision = 0

  initialize(openClawPath?: string): void {
    const agentConfigPath =
      normalizeOpenClawPath(openClawPath) ||
      path.join(os.homedir(), '.openclaw')

    if (this.initialized) {
      void this.shutdown()
    }

    this.refreshGeneration++
    const generation = this.refreshGeneration
    this.activeOpenClawPath = agentConfigPath
    this.analyticsStatus = 'scanning'
    this.lastScanStartedAt = new Date().toISOString()
    this.lastScanCompletedAt = undefined
    this.lastScanError = undefined
    this.hasCompletedScan = false

    if (!fs.existsSync(agentConfigPath)) {
      this.analyticsStatus = 'unavailable'
      this.initialized = true
      return
    }

    this.loadSessionCache(agentConfigPath)

    // Load agents
    const agents = loadAgents(agentConfigPath)
    for (const agent of agents) {
      this.agents.set(agent.id, agent)
      this.loadCachedAgentSessions(agentConfigPath, agent)
    }

    // Watch agent config
    const configWatcher = watchAgentConfig(agentConfigPath, (updatedAgents) => {
      const activeAgentIds = new Set(updatedAgents.map((agent) => agent.id))
      for (const [sessionId, session] of this.sessions) {
        if (!activeAgentIds.has(session.agentId)) {
          this.sessions.delete(sessionId)
          this.sessionFileKeys.delete(sessionId)
        }
      }
      for (const [cacheKey, entry] of this.sessionCache) {
        if (!activeAgentIds.has(entry.agentId)) {
          this.sessionCache.delete(cacheKey)
        }
      }
      this.agents.clear()
      for (const agent of updatedAgents) {
        this.agents.set(agent.id, agent)
        this.loadCachedAgentSessions(agentConfigPath, agent)
      }
      this.markDirty()
      this.scheduleSessionCacheSave()
      this.scheduleBackgroundSessionRefresh(
        agentConfigPath,
        updatedAgents,
        this.refreshGeneration
      )
    })
    if (configWatcher) this.watchers.push(configWatcher)

    // Tool call cleanup interval
    this.toolCleanupInterval = setInterval(
      () => {
        this.cleanupStalePendingCalls()
      },
      5 * 60 * 1000
    )

    this.initialized = true
    this.scheduleBackgroundSessionRefresh(agentConfigPath, agents, generation)
  }

  shutdown(): Promise<void> {
    this.refreshGeneration++

    for (const watcher of this.watchers) {
      watcher.close()
    }
    this.watchers.length = 0
    if (this.budgetCheckTimeout) {
      clearTimeout(this.budgetCheckTimeout)
      this.budgetCheckTimeout = null
    }
    if (this.backgroundRefreshTimer) {
      clearTimeout(this.backgroundRefreshTimer)
      this.backgroundRefreshTimer = null
    }
    if (this.toolCleanupInterval) {
      clearInterval(this.toolCleanupInterval)
      this.toolCleanupInterval = null
    }
    const cacheFlush = this.flushSessionCache()
    this.sessions.clear()
    this.agents.clear()
    this.sessionCache.clear()
    this.sessionFileKeys.clear()
    this.pendingToolCalls.clear()
    this.dbSeqCheckpoints.clear()
    this.parsingFiles.clear()
    this.lastCachePayload = null
    this.queuedBackgroundRefresh = null
    this.activeOpenClawPath = ''
    this.analyticsStatus = 'unavailable'
    this.lastScanStartedAt = undefined
    this.lastScanCompletedAt = undefined
    this.lastScanError = undefined
    this.hasCompletedScan = false
    this.initialized = false
    return Promise.all([cacheFlush, this.cacheSaveCompletion]).then(() => {})
  }

  getStatus(): AnalyticsStatusResponse {
    return {
      status: this.analyticsStatus,
      // Keep this O(1): the status endpoint is polled frequently while an
      // initial scan is running. A metadata-only session still represents an
      // available OpenClaw data source and is safe to expose as a snapshot.
      hasData: this.sessions.size > 0,
      timestamp: new Date().toISOString(),
      ...(this.lastScanStartedAt
        ? { lastScanStartedAt: this.lastScanStartedAt }
        : {}),
      ...(this.lastScanCompletedAt
        ? { lastScanCompletedAt: this.lastScanCompletedAt }
        : {}),
      ...(this.lastScanError ? { lastScanError: this.lastScanError } : {}),
    }
  }

  private loadCachedAgentSessions(
    openClawPath: string,
    agent: OpenClawAgent
  ): void {
    const agentPath = path.join(openClawPath, 'agents', agent.id)
    if (!fs.existsSync(agentPath)) {
      return
    }

    // Load session metadata from sessions.json for channel info
    const sessionMetas = loadSessionIndex(agentPath)
    const metaBySessionId = new Map<string, SessionMetadata>()
    for (const meta of sessionMetas) {
      metaBySessionId.set(meta.id, meta)
    }

    let restored = 0
    const preferredCacheKeys = new Set(
      this.getPreferredSessionFiles(
        [...this.sessionCache.values()]
          .filter((entry) => entry.agentId === agent.id)
          .map((entry) => entry.filePath)
      ).map((filePath) => this.getFileCacheKey(filePath))
    )

    for (const [cacheKey, entry] of this.sessionCache) {
      if (entry.agentId !== agent.id || this.sessions.has(entry.sessionId)) {
        continue
      }

      // Canonical SQLite-backed entries: restore the parsed data and use the
      // persisted seq checkpoint so the database load below only reads new
      // events. Freshness is keyed off lastSeq, not file mtime/size.
      if (entry.lastSeq !== undefined) {
        if (entry.pricingRevision !== this.pricingRevision) continue
        this.dbSeqCheckpoints.set(cacheKey, entry.lastSeq)
        const session = this.deserializeSession(entry, {
          sessionId: entry.sessionId,
          agentId: agent.id,
          projectPath: agent.workspace || agentPath,
          channel: entry.channel,
        })
        this.sessions.set(entry.sessionId, session)
        this.sessionFileKeys.set(entry.sessionId, cacheKey)
        restored++
        continue
      }

      if (!preferredCacheKeys.has(cacheKey)) {
        continue
      }

      const stat = this.safeStat(entry.filePath)
      if (
        !stat ||
        !this.isCacheEntryFresh(entry, entry.sessionId, agent.id, stat)
      ) {
        continue
      }

      const meta = metaBySessionId.get(entry.sessionId)
      const session = this.deserializeSession(entry, {
        sessionId: entry.sessionId,
        agentId: agent.id,
        projectPath: agent.workspace || agentPath,
        channel: meta?.channel,
      })

      this.sessions.set(entry.sessionId, session)
      this.sessionFileKeys.set(entry.sessionId, cacheKey)
      restored++
    }

    if (restored > 0) {
      this.markDirty()
    }

    // Watch for new sessions
    const sessionWatcher = watchSessionIndex(
      agentPath,
      async (session: SessionMetadata) => {
        if (!this.agents.has(agent.id)) return
        if (this.sessions.has(session.id)) return

        const logPath = path.join(agentPath, 'sessions', `${session.id}.jsonl`)
        if (
          await this.parseSessionFile(
            logPath,
            session.id,
            agent.id,
            agent.workspace || agentPath,
            session.channel
          )
        ) {
          this.markDirty()
          broadcastNewSession(session.id)
          broadcastCostsUpdated()
          this.debouncedBudgetCheck()
        }
      }
    )
    if (sessionWatcher) this.watchers.push(sessionWatcher)

    this.watchSessionDirectory(
      agentPath,
      agent.id,
      agent.workspace || agentPath
    )
    this.watchAgentDatabase(agentPath, agent.id)
  }

  private getPreferredSessionFiles(filePaths: string[]): string[] {
    const filesBySession = new Map<string, string[]>()

    for (const filePath of filePaths) {
      const fileName = path.basename(filePath)
      const sessionId = getSessionIdFromFileName(fileName)
      if (!sessionId || !isSessionTranscriptFileName(fileName)) continue

      const files = filesBySession.get(sessionId) ?? []
      files.push(filePath)
      filesBySession.set(sessionId, files)
    }

    const preferred: string[] = []
    for (const files of filesBySession.values()) {
      const activeFiles = files.filter((filePath) =>
        isActiveSessionTranscriptFileName(path.basename(filePath))
      )
      const candidates = activeFiles.length > 0 ? activeFiles : files
      const selected = [...candidates].sort((left, right) => {
        const leftMtime = this.safeStat(left)?.mtimeMs ?? 0
        const rightMtime = this.safeStat(right)?.mtimeMs ?? 0
        return rightMtime - leftMtime || right.localeCompare(left)
      })[0]
      if (selected) preferred.push(selected)
    }

    return preferred.sort((left, right) =>
      left < right ? -1 : left > right ? 1 : 0
    )
  }

  /**
   * Resolve the preferred transcript file for a single session without
   * stat-ing/sorting every transcript of every session (used by the file
   * watcher where events arrive per file).
   */
  private findPreferredFileForSession(
    sessionId: string,
    files: string[]
  ): string | undefined {
    const candidates = files.filter(
      (filePath) =>
        getSessionIdFromFileName(path.basename(filePath)) === sessionId
    )
    if (candidates.length === 0) return undefined

    const activeFiles = candidates.filter((filePath) =>
      isActiveSessionTranscriptFileName(path.basename(filePath))
    )
    const pool = activeFiles.length > 0 ? activeFiles : candidates
    if (pool.length === 1) return pool[0]

    return [...pool].sort((left, right) => {
      const leftMtime = this.safeStat(left)?.mtimeMs ?? 0
      const rightMtime = this.safeStat(right)?.mtimeMs ?? 0
      return rightMtime - leftMtime || right.localeCompare(left)
    })[0]
  }

  private isCanonicalDatabaseSession(
    agentPath: string,
    sessionId: string
  ): boolean {
    const sourceKey = this.sessionFileKeys.get(sessionId)
    return Boolean(
      sourceKey?.startsWith(
        `${this.getFileCacheKey(getOpenClawAgentDatabasePath(agentPath))}#`
      )
    )
  }

  private getDatabaseSessionKey(
    databasePath: string,
    sessionId: string
  ): string {
    return `${this.getFileCacheKey(databasePath)}#${sessionId}`
  }

  private parsedRequestFromResult(result: ParsedOpenClawResult): ParsedRequest {
    return {
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
    }
  }

  private appendRequestsToSession(
    session: SessionData,
    requests: ParsedRequest[]
  ): boolean {
    for (const request of requests) {
      session.requests.push(request)
      session.totalCost += request.cost
      session.totalInputTokens += request.inputTokens
      session.totalOutputTokens += request.outputTokens
      if (request.model && request.model !== 'unknown') {
        session.modelsUsed.add(request.model)
      }
    }
    return requests.length > 0
  }

  private async loadAgentDatabaseSessions(
    agentPath: string,
    agent: OpenClawAgent,
    generation: number
  ): Promise<{ sessionIds: Set<string>; changed: boolean }> {
    const databasePath = getOpenClawAgentDatabasePath(agentPath)
    const pricingRevision = this.pricingRevision
    const dbCacheKey = this.getFileCacheKey(databasePath)
    const sourcePrefix = `${dbCacheKey}#`
    const sessionIds = new Set<string>()

    const collectExistingDbSessionIds = (): Set<string> => {
      for (const [sessionId, sourceKey] of this.sessionFileKeys) {
        if (sourceKey.startsWith(sourcePrefix)) {
          sessionIds.add(sessionId)
        }
      }
      return sessionIds
    }

    let reader: ReturnType<typeof openAgentDatabaseReader> = null
    try {
      reader = openAgentDatabaseReader(agentPath)
    } catch (error) {
      if (!isProduction) {
        console.warn(
          `Unable to read OpenClaw agent database: ${
            error instanceof Error ? error.message : String(error)
          }`
        )
      }
      return { sessionIds: collectExistingDbSessionIds(), changed: false }
    }

    if (!reader) {
      // Database file does not exist yet - keep whatever is already loaded.
      return { sessionIds: collectExistingDbSessionIds(), changed: false }
    }

    let changed = false

    try {
      // Resolved lazily: only the "empty DB session + legacy JSONL owner"
      // case needs the JSONL listing.
      let legacySessionIds: Set<string> | null = null
      const getLegacySessionIds = (): Set<string> => {
        if (!legacySessionIds) {
          legacySessionIds = new Set(
            listSessionFiles(agentPath).map((filePath) =>
              getSessionIdFromFileName(path.basename(filePath))
            )
          )
        }
        return legacySessionIds
      }

      const fallbackTimestamp = '1970-01-01T00:00:00.000Z'

      for (const [sessionId, meta] of reader.sessionMeta) {
        if (generation !== this.refreshGeneration || !this.initialized) {
          return { sessionIds, changed }
        }

        const checkpointKey = this.getDatabaseSessionKey(
          databasePath,
          sessionId
        )
        const checkpoint = this.dbSeqCheckpoints.get(checkpointKey)
        const maxSeq = reader.maxSeqBySession.get(sessionId)
        const previous = this.sessions.get(sessionId)
        const previousIsCanonical = Boolean(
          previous &&
          this.sessionFileKeys.get(sessionId)?.startsWith(sourcePrefix)
        )

        // Full per-session reload when there is no usable checkpoint, when
        // the checkpoint is ahead of the database (rebuilt/truncated DB), or
        // when the session currently belongs to a JSONL transcript - SQLite
        // is the canonical source, so it must be replaced wholesale.
        const fullReload =
          maxSeq === undefined ||
          checkpoint === undefined ||
          checkpoint > maxSeq ||
          !previousIsCanonical

        let afterSeq = fullReload ? -1 : checkpoint
        const newRequests: ParsedRequest[] = []
        let minTimestamp: string | undefined
        let maxTimestamp: string | undefined
        let rowsRead = 0

        while (true) {
          const page = reader.readEvents(
            sessionId,
            afterSeq,
            DB_EVENTS_PAGE_SIZE
          )
          rowsRead += page.rows.length

          for (const row of page.rows) {
            if (!row.line) continue
            try {
              const parsed = parseOpenClawEntry(
                JSON.parse(row.line) as OpenClawLogEntry,
                sessionId,
                agent.id
              )
              if (!parsed) continue
              newRequests.push(this.parsedRequestFromResult(parsed))
              if (!minTimestamp || parsed.timestamp < minTimestamp) {
                minTimestamp = parsed.timestamp
              }
              if (!maxTimestamp || parsed.timestamp > maxTimestamp) {
                maxTimestamp = parsed.timestamp
              }
            } catch {
              // Skip unparsable event payloads
            }
          }

          if (page.rows.length > 0) {
            afterSeq = page.rows[page.rows.length - 1].seq
          }
          if (page.rows.length < DB_EVENTS_PAGE_SIZE) {
            break
          }
          await this.yieldToEventLoop()
          if (generation !== this.refreshGeneration || !this.initialized) {
            return { sessionIds, changed }
          }
        }

        const rebuild = fullReload || !previous

        if (
          rebuild &&
          newRequests.length === 0 &&
          getLegacySessionIds().has(sessionId)
        ) {
          // A partially migrated/older database may contain session metadata
          // while its legacy transcript still owns the actual usage records.
          // Let the JSONL fallback handle that file instead of hiding it.
          continue
        }

        let session: SessionData
        let sessionChanged = false
        if (!rebuild && previous) {
          session = previous
          if (this.appendRequestsToSession(session, newRequests)) {
            sessionChanged = true
          }
          if (minTimestamp && minTimestamp < session.startedAt) {
            session.startedAt = minTimestamp
          }
          if (maxTimestamp && maxTimestamp > session.lastActivity) {
            session.lastActivity = maxTimestamp
          }
        } else {
          const sessionStart =
            meta.startedAt ||
            meta.createdAt ||
            meta.lastActivity ||
            fallbackTimestamp
          session = {
            id: sessionId,
            agentId: agent.id,
            projectPath: agent.workspace || agentPath,
            startedAt: sessionStart,
            lastActivity: meta.lastActivity || sessionStart,
            channel: meta.channel,
            requests: [],
            totalCost: 0,
            totalInputTokens: 0,
            totalOutputTokens: 0,
            modelsUsed: new Set(),
            toolCalls: [],
          }
          this.appendRequestsToSession(session, newRequests)
          if (minTimestamp && minTimestamp < session.startedAt) {
            session.startedAt = minTimestamp
          }
          if (maxTimestamp && maxTimestamp > session.lastActivity) {
            session.lastActivity = maxTimestamp
          }
          // A new session or a source replacement changes the published data.
          sessionChanged = !previous || rowsRead > 0
        }

        // Session metadata affects active-session and channel aggregates even
        // when no transcript rows were added.
        const previousChannel = session.channel
        const previousStartedAt = session.startedAt
        const previousLastActivity = session.lastActivity
        session.channel = meta.channel
        if (meta.lastActivity && meta.lastActivity > session.lastActivity) {
          session.lastActivity = meta.lastActivity
        }
        if (meta.startedAt && meta.startedAt < session.startedAt) {
          session.startedAt = meta.startedAt
        }

        if (
          previousChannel !== session.channel ||
          previousStartedAt !== session.startedAt ||
          previousLastActivity !== session.lastActivity
        ) {
          sessionChanged = true
        }

        if (sessionChanged) changed = true

        if (maxSeq !== undefined) {
          const lastSeq = fullReload
            ? maxSeq
            : Math.max(checkpoint ?? afterSeq, afterSeq)
          this.dbSeqCheckpoints.set(checkpointKey, lastSeq)
        }

        this.sessions.set(sessionId, session)
        this.sessionFileKeys.set(sessionId, checkpointKey)

        // Persist the parsed session together with its seq checkpoint so a
        // restart resumes incrementally instead of re-reading the database.
        this.sessionCache.set(checkpointKey, {
          filePath: databasePath,
          sessionId,
          agentId: agent.id,
          projectPath: session.projectPath,
          channel: session.channel,
          size: 0,
          mtimeMs: 0,
          parsedAt: new Date().toISOString(),
          pricingRevision,
          session: this.serializeSession(session),
          lastSeq: this.dbSeqCheckpoints.get(checkpointKey),
        })

        sessionIds.add(sessionId)

        if (rowsRead > 0) {
          await this.yieldToEventLoop()
          if (generation !== this.refreshGeneration || !this.initialized) {
            return { sessionIds, changed }
          }
        }
      }
    } finally {
      reader.close()
    }

    return { sessionIds, changed }
  }

  private watchAgentDatabase(agentPath: string, agentId: string): void {
    const databasePath = getOpenClawAgentDatabasePath(agentPath)

    const watcher = chokidar.watch([databasePath, `${databasePath}-wal`], {
      persistent: true,
      ignoreInitial: true,
      usePolling: this.shouldUsePollingWatcher(databasePath),
      interval: 1000,
      awaitWriteFinish: { stabilityThreshold: 300, pollInterval: 50 },
    })
    const refreshFromDatabaseChange = () => {
      if (!this.agents.has(agentId)) return
      const agent = this.agents.get(agentId)
      if (!agent) return
      // Only rescan the agent whose database actually changed. Passing the
      // full agent list here made every database write re-scan all agents.
      this.scheduleBackgroundSessionRefresh(
        this.activeOpenClawPath,
        [agent],
        this.refreshGeneration
      )
    }
    watcher.on('change', refreshFromDatabaseChange)
    watcher.on('add', refreshFromDatabaseChange)
    watcher.on('error', (error) => {
      if (!isProduction) {
        console.warn(
          `Error watching OpenClaw agent database ${databasePath}:`,
          error
        )
      }
    })
    this.watchers.push(watcher)
  }

  private watchSessionDirectory(
    agentPath: string,
    agentId: string,
    projectPath: string
  ): void {
    const sessionsDir = path.join(agentPath, 'sessions')
    if (!fs.existsSync(sessionsDir)) return

    const watcher = chokidar.watch(sessionsDir, {
      persistent: true,
      ignoreInitial: true,
      depth: 0,
      usePolling: this.shouldUsePollingWatcher(sessionsDir),
      interval: 1000,
      awaitWriteFinish: { stabilityThreshold: 300, pollInterval: 50 },
    })

    const handleSessionFile = async (
      filePath: string,
      isNewSession: boolean
    ) => {
      if (!this.agents.has(agentId)) return
      const fileName = path.basename(filePath)
      const sessionId = getSessionIdFromFileName(fileName)
      if (!sessionId || !isSessionTranscriptFileName(fileName)) {
        return
      }

      if (this.isCanonicalDatabaseSession(agentPath, sessionId)) {
        return
      }

      const preferredFile = this.findPreferredFileForSession(
        sessionId,
        listSessionFiles(agentPath)
      )
      if (
        preferredFile &&
        this.getFileCacheKey(preferredFile) !== this.getFileCacheKey(filePath)
      ) {
        return
      }

      const meta = loadSessionIndex(agentPath).find(
        (session) => session.id === sessionId
      )
      if (
        await this.parseSessionFile(
          filePath,
          sessionId,
          agentId,
          projectPath,
          meta?.channel
        )
      ) {
        this.markDirty()
        if (isNewSession) {
          broadcastNewSession(sessionId)
        }
        broadcastCostsUpdated()
        this.debouncedBudgetCheck()
      }
    }

    watcher.on('add', (filePath) => {
      void handleSessionFile(filePath, true)
    })
    watcher.on('change', (filePath) => {
      void handleSessionFile(filePath, false)
    })
    watcher.on('unlink', (filePath) => {
      const fileName = path.basename(filePath)
      const sessionId = getSessionIdFromFileName(fileName)
      if (!sessionId || !isSessionTranscriptFileName(fileName)) {
        return
      }

      const cacheKey = this.getFileCacheKey(filePath)
      if (this.sessionFileKeys.get(sessionId) !== cacheKey) {
        // A canonical SQLite session or a newer transcript may still own this
        // session id. Removing an archived file must not remove that source.
        this.sessionCache.delete(cacheKey)
        this.scheduleSessionCacheSave()
        return
      }
      this.sessions.delete(sessionId)
      this.sessionFileKeys.delete(sessionId)
      this.sessionCache.delete(cacheKey)

      const fallbackFile = this.findPreferredFileForSession(
        sessionId,
        listSessionFiles(agentPath)
      )
      void (async () => {
        if (fallbackFile) {
          const meta = loadSessionIndex(agentPath).find(
            (session) => session.id === sessionId
          )
          await this.parseSessionFile(
            fallbackFile,
            sessionId,
            agentId,
            projectPath,
            meta?.channel
          )
        }
        this.markDirty()
        this.scheduleSessionCacheSave()
        broadcastCostsUpdated()
      })()
    })
    watcher.on('error', (error) => {
      if (!isProduction) {
        console.warn(`Error watching session directory ${sessionsDir}:`, error)
      }
    })

    this.watchers.push(watcher)
  }

  private getSessionCachePath(): string {
    return path.join(getConfigDir(), SESSION_CACHE_FILE)
  }

  private getFileCacheKey(filePath: string): string {
    const normalized = path.resolve(filePath)
    return process.platform === 'win32' ? normalized.toLowerCase() : normalized
  }

  private safeStat(filePath: string): FsStats | null {
    try {
      return fs.statSync(filePath)
    } catch {
      return null
    }
  }

  private shouldUsePollingWatcher(filePath: string): boolean {
    const normalized = filePath.replace(/\\/g, '/').toLowerCase()
    return (
      normalized.startsWith('//wsl.localhost/') ||
      normalized.startsWith('//wsl$/')
    )
  }

  private isCacheEntryFresh(
    entry: CachedSessionEntry,
    sessionId: string,
    agentId: string,
    stat: FsStats
  ): boolean {
    return (
      entry.sessionId === sessionId &&
      entry.agentId === agentId &&
      entry.pricingRevision === this.pricingRevision &&
      entry.size === stat.size &&
      Math.abs(entry.mtimeMs - stat.mtimeMs) < 1
    )
  }

  private serializeSession(session: SessionData): SerializedSessionData {
    return {
      id: session.id,
      agentId: session.agentId,
      projectPath: session.projectPath,
      startedAt: session.startedAt,
      lastActivity: session.lastActivity,
      channel: session.channel,
      requests: session.requests,
      totalCost: session.totalCost,
      totalInputTokens: session.totalInputTokens,
      totalOutputTokens: session.totalOutputTokens,
      modelsUsed: [...session.modelsUsed],
      toolCalls: session.toolCalls,
    }
  }

  private deserializeSession(
    entry: CachedSessionEntry,
    overrides?: {
      sessionId?: string
      agentId?: string
      projectPath?: string
      channel?: string
    }
  ): SessionData {
    const cached = entry.session
    const startedAt = cached.startedAt || new Date().toISOString()
    const totalCost = Number(cached.totalCost)
    const totalInputTokens = Number(cached.totalInputTokens)
    const totalOutputTokens = Number(cached.totalOutputTokens)

    return {
      id: overrides?.sessionId ?? cached.id,
      agentId: overrides?.agentId ?? cached.agentId,
      projectPath: overrides?.projectPath ?? cached.projectPath,
      startedAt,
      lastActivity: cached.lastActivity || startedAt,
      channel: overrides?.channel ?? cached.channel,
      requests: Array.isArray(cached.requests) ? cached.requests : [],
      totalCost: Number.isFinite(totalCost) ? totalCost : 0,
      totalInputTokens: Number.isFinite(totalInputTokens)
        ? totalInputTokens
        : 0,
      totalOutputTokens: Number.isFinite(totalOutputTokens)
        ? totalOutputTokens
        : 0,
      modelsUsed: new Set(
        Array.isArray(cached.modelsUsed) ? cached.modelsUsed : []
      ),
      toolCalls: Array.isArray(cached.toolCalls) ? cached.toolCalls : [],
    }
  }

  private normalizeCachedEntry(value: unknown): CachedSessionEntry | null {
    if (!value || typeof value !== 'object') {
      return null
    }

    const entry = value as Partial<CachedSessionEntry>
    const session = entry.session as Partial<SerializedSessionData> | undefined

    if (
      typeof entry.filePath !== 'string' ||
      typeof entry.sessionId !== 'string' ||
      typeof entry.agentId !== 'string' ||
      typeof entry.projectPath !== 'string' ||
      typeof entry.size !== 'number' ||
      typeof entry.mtimeMs !== 'number' ||
      !session ||
      typeof session.id !== 'string' ||
      typeof session.agentId !== 'string' ||
      typeof session.projectPath !== 'string' ||
      !Array.isArray(session.requests) ||
      !Array.isArray(session.modelsUsed) ||
      !Array.isArray(session.toolCalls)
    ) {
      return null
    }

    return {
      filePath: entry.filePath,
      sessionId: entry.sessionId,
      agentId: entry.agentId,
      projectPath: entry.projectPath,
      channel: typeof entry.channel === 'string' ? entry.channel : undefined,
      size: entry.size,
      mtimeMs: entry.mtimeMs,
      parsedAt:
        typeof entry.parsedAt === 'string'
          ? entry.parsedAt
          : new Date().toISOString(),
      ...(typeof entry.lastSeq === 'number' &&
      Number.isSafeInteger(entry.lastSeq) &&
      entry.lastSeq >= 0
        ? { lastSeq: entry.lastSeq }
        : {}),
      ...(typeof entry.pricingRevision === 'number' &&
      Number.isSafeInteger(entry.pricingRevision)
        ? { pricingRevision: entry.pricingRevision }
        : {}),
      session: {
        id: session.id,
        agentId: session.agentId,
        projectPath: session.projectPath,
        startedAt:
          typeof session.startedAt === 'string'
            ? session.startedAt
            : new Date().toISOString(),
        lastActivity:
          typeof session.lastActivity === 'string'
            ? session.lastActivity
            : typeof session.startedAt === 'string'
              ? session.startedAt
              : new Date().toISOString(),
        channel:
          typeof session.channel === 'string' ? session.channel : undefined,
        requests: session.requests as ParsedRequest[],
        totalCost:
          typeof session.totalCost === 'number' ? session.totalCost : 0,
        totalInputTokens:
          typeof session.totalInputTokens === 'number'
            ? session.totalInputTokens
            : 0,
        totalOutputTokens:
          typeof session.totalOutputTokens === 'number'
            ? session.totalOutputTokens
            : 0,
        modelsUsed: session.modelsUsed.filter(
          (model): model is string => typeof model === 'string'
        ),
        toolCalls: session.toolCalls as ToolCallData[],
      },
    }
  }

  private loadSessionCache(openClawPath: string): void {
    this.sessionCache.clear()

    const cachePath = this.getSessionCachePath()
    if (!fs.existsSync(cachePath)) {
      return
    }

    try {
      const cache = JSON.parse(
        fs.readFileSync(cachePath, 'utf-8')
      ) as Partial<SessionCacheFile>
      if (
        cache.version !== SESSION_CACHE_VERSION ||
        cache.openClawPath !== openClawPath ||
        !Array.isArray(cache.entries)
      ) {
        return
      }

      for (const rawEntry of cache.entries) {
        const entry = this.normalizeCachedEntry(rawEntry)
        if (!entry) continue

        // SQLite has one file for many sessions; its cache key must include
        // the session id so entries do not overwrite one another on restart.
        const cacheKey =
          entry.lastSeq !== undefined
            ? this.getDatabaseSessionKey(entry.filePath, entry.sessionId)
            : this.getFileCacheKey(entry.filePath)
        this.sessionCache.set(cacheKey, entry)
      }
    } catch (error) {
      if (!isProduction) {
        console.warn('Failed to load analytics session cache:', error)
      }
      this.sessionCache.clear()
    }
  }

  private restoreCachedSession(
    filePath: string,
    sessionId: string,
    agentId: string,
    projectPath: string,
    channel: string | undefined,
    stat: FsStats
  ): boolean {
    const cacheKey = this.getFileCacheKey(filePath)
    const entry = this.sessionCache.get(cacheKey)

    if (!entry || !this.isCacheEntryFresh(entry, sessionId, agentId, stat)) {
      return false
    }

    const session = this.deserializeSession(entry, {
      sessionId,
      agentId,
      projectPath,
      channel,
    })

    this.sessions.set(sessionId, session)
    this.sessionFileKeys.set(sessionId, cacheKey)
    return true
  }

  private updateSessionCache(
    filePath: string,
    sessionId: string,
    agentId: string,
    projectPath: string,
    channel: string | undefined,
    stat: FsStats,
    session: SessionData,
    pricingRevision = this.pricingRevision
  ): void {
    const entry: CachedSessionEntry = {
      filePath,
      sessionId,
      agentId,
      projectPath,
      channel,
      size: stat.size,
      mtimeMs: stat.mtimeMs,
      parsedAt: new Date().toISOString(),
      pricingRevision,
      session: this.serializeSession(session),
    }

    const cacheKey = this.getFileCacheKey(filePath)
    this.sessionCache.set(cacheKey, entry)
    this.sessionFileKeys.set(sessionId, cacheKey)
    this.scheduleSessionCacheSave()
  }

  private scheduleSessionCacheSave(): void {
    if (!this.activeOpenClawPath) {
      return
    }

    if (this.cacheSaveTimer) {
      clearTimeout(this.cacheSaveTimer)
    }

    this.cacheSaveTimer = setTimeout(() => {
      this.cacheSaveTimer = null
      this.cacheSaveCompletion = this.saveSessionCacheNow()
    }, CACHE_SAVE_DEBOUNCE_MS)

    this.cacheSaveTimer.unref?.()
  }

  private flushSessionCache(): Promise<void> {
    if (!this.cacheSaveTimer) {
      return Promise.resolve()
    }

    clearTimeout(this.cacheSaveTimer)
    this.cacheSaveTimer = null
    this.cacheSaveCompletion = this.saveSessionCacheNow()
    return this.cacheSaveCompletion
  }

  private async saveSessionCacheNow(): Promise<void> {
    if (!this.activeOpenClawPath) {
      return
    }

    if (this.cacheSaveInFlight) {
      // A write is already running; re-schedule once it settles so the
      // latest state is never lost.
      this.cacheSavePending = true
      return this.cacheSaveCompletion
    }
    this.cacheSaveInFlight = true

    try {
      const cachePath = this.getSessionCachePath()
      const cache: SessionCacheFile = {
        version: SESSION_CACHE_VERSION,
        openClawPath: this.activeOpenClawPath,
        entries: [...this.sessionCache.values()],
      }
      const payload = JSON.stringify(cache)
      if (payload === this.lastCachePayload) {
        return
      }
      this.lastCachePayload = payload

      await fs.promises.mkdir(path.dirname(cachePath), { recursive: true })
      const tempPath = `${cachePath}.${process.pid}.tmp`
      await fs.promises.writeFile(tempPath, payload, 'utf-8')
      await fs.promises.rename(tempPath, cachePath)
    } catch (error) {
      if (!isProduction) {
        console.warn('Failed to save analytics session cache:', error)
      }
    } finally {
      this.cacheSaveInFlight = false
      if (this.cacheSavePending) {
        this.cacheSavePending = false
        this.scheduleSessionCacheSave()
      }
    }
  }

  private scheduleBackgroundSessionRefresh(
    openClawPath: string,
    agents: OpenClawAgent[],
    generation: number
  ): void {
    if (this.backgroundRefreshTimer) {
      clearTimeout(this.backgroundRefreshTimer)
    }

    this.analyticsStatus = 'scanning'
    this.lastScanStartedAt = new Date().toISOString()
    this.lastScanError = undefined

    if (this.backgroundRefreshPromise) {
      const queuedAgents = new Map(
        (this.queuedBackgroundRefresh?.agents ?? []).map((agent) => [
          agent.id,
          agent,
        ])
      )
      for (const agent of agents) queuedAgents.set(agent.id, agent)
      this.queuedBackgroundRefresh = {
        openClawPath,
        agents: [...queuedAgents.values()],
        generation,
      }
      return
    }

    this.backgroundRefreshTimer = setTimeout(() => {
      this.backgroundRefreshTimer = null

      if (this.backgroundRefreshPromise) {
        const queuedAgents = new Map(
          (this.queuedBackgroundRefresh?.agents ?? []).map((agent) => [
            agent.id,
            agent,
          ])
        )
        for (const agent of agents) queuedAgents.set(agent.id, agent)
        this.queuedBackgroundRefresh = {
          openClawPath,
          agents: [...queuedAgents.values()],
          generation,
        }
        return
      }

      this.startBackgroundSessionRefresh(openClawPath, agents, generation)
    }, BACKGROUND_SESSION_REFRESH_DELAY_MS)

    this.backgroundRefreshTimer.unref?.()
  }

  private startBackgroundSessionRefresh(
    openClawPath: string,
    agents: OpenClawAgent[],
    generation: number
  ): Promise<void> {
    this.analyticsStatus = 'scanning'
    this.lastScanStartedAt = new Date().toISOString()
    this.lastScanError = undefined
    this.backgroundRefreshPromise = this.refreshSessionFilesInBackground(
      openClawPath,
      agents,
      generation
    ).finally(() => {
      this.backgroundRefreshPromise = null
      const queuedRefresh = this.queuedBackgroundRefresh
      this.queuedBackgroundRefresh = null
      if (queuedRefresh && this.initialized) {
        this.scheduleBackgroundSessionRefresh(
          queuedRefresh.openClawPath,
          queuedRefresh.agents,
          queuedRefresh.generation
        )
      }
    })
    return this.backgroundRefreshPromise
  }

  async refreshNow(): Promise<void> {
    if (this.backgroundRefreshTimer) {
      clearTimeout(this.backgroundRefreshTimer)
      this.backgroundRefreshTimer = null
    }

    if (this.backgroundRefreshPromise) {
      await this.backgroundRefreshPromise
      if (this.analyticsStatus === 'error') {
        throw new Error(this.lastScanError?.message ?? 'Analytics scan failed')
      }
      return
    }

    await this.startBackgroundSessionRefresh(
      this.activeOpenClawPath,
      [...this.agents.values()],
      this.refreshGeneration
    )
    if (this.analyticsStatus === 'error') {
      throw new Error(this.lastScanError?.message ?? 'Analytics scan failed')
    }
  }

  /** Drop parsed cost snapshots after pricing changes and rebuild them. */
  invalidateCostCache(): void {
    if (!this.initialized || !this.activeOpenClawPath) return
    this.pricingRevision++
    this.sessionCache.clear()
    this.sessions.clear()
    this.sessionFileKeys.clear()
    this.dbSeqCheckpoints.clear()
    this.markDirty()
    this.scheduleBackgroundSessionRefresh(
      this.activeOpenClawPath,
      [...this.agents.values()],
      this.refreshGeneration
    )
  }

  private async yieldToEventLoop(): Promise<void> {
    await new Promise<void>((resolve) => setImmediate(resolve))
  }

  private removeMissingSessionFiles(
    activeFileKeys: Set<string>,
    scopedAgentIds: Set<string>
  ): boolean {
    let changed = false

    for (const [sessionId, cacheKey] of [...this.sessionFileKeys]) {
      const session = this.sessions.get(sessionId)
      if (!session || !scopedAgentIds.has(session.agentId)) continue
      if (!activeFileKeys.has(cacheKey)) {
        this.sessions.delete(sessionId)
        this.sessionFileKeys.delete(sessionId)
        changed = true
      }
    }

    for (const cacheKey of [...this.sessionCache.keys()]) {
      const entry = this.sessionCache.get(cacheKey)
      if (!entry || !scopedAgentIds.has(entry.agentId)) continue
      if (!activeFileKeys.has(cacheKey)) {
        this.sessionCache.delete(cacheKey)
        changed = true
      }
    }

    if (changed) {
      this.markDirty()
      this.scheduleSessionCacheSave()
    }

    return changed
  }

  private async refreshSessionFilesInBackground(
    openClawPath: string,
    agents: OpenClawAgent[],
    generation: number
  ): Promise<void> {
    if (generation !== this.refreshGeneration || !this.initialized) {
      return
    }

    const activeFileKeys = new Set<string>()
    let checked = 0
    let parsed = 0
    let restored = 0
    let changed = false

    try {
      for (const agent of agents) {
        if (generation !== this.refreshGeneration || !this.initialized) {
          return
        }

        const agentPath = path.join(openClawPath, 'agents', agent.id)
        if (!fs.existsSync(agentPath)) {
          continue
        }

        const databasePath = getOpenClawAgentDatabasePath(agentPath)
        const databaseResult = await this.loadAgentDatabaseSessions(
          agentPath,
          agent,
          generation
        )
        const databaseSessionIds = databaseResult.sessionIds
        for (const sessionId of databaseSessionIds) {
          activeFileKeys.add(
            this.getDatabaseSessionKey(databasePath, sessionId)
          )
        }
        if (databaseResult.changed) {
          changed = true
        }

        const sessionMetas = loadSessionIndex(agentPath)
        const metaBySessionId = new Map<string, SessionMetadata>()
        for (const meta of sessionMetas) {
          metaBySessionId.set(meta.id, meta)
        }

        const files = this.getPreferredSessionFiles(listSessionFiles(agentPath))

        for (const filePath of files) {
          if (generation !== this.refreshGeneration || !this.initialized) {
            return
          }

          const sessionId = getSessionIdFromFileName(path.basename(filePath))
          if (!sessionId || databaseSessionIds.has(sessionId)) continue

          const stat = this.safeStat(filePath)
          if (!stat) continue

          const cacheKey = this.getFileCacheKey(filePath)
          activeFileKeys.add(cacheKey)

          const meta = metaBySessionId.get(sessionId)
          const projectPath = agent.workspace || agentPath
          const channel = meta?.channel
          const entry = this.sessionCache.get(cacheKey)

          if (
            entry &&
            this.isCacheEntryFresh(entry, sessionId, agent.id, stat)
          ) {
            if (!this.sessions.has(sessionId)) {
              if (
                this.restoreCachedSession(
                  filePath,
                  sessionId,
                  agent.id,
                  projectPath,
                  channel,
                  stat
                )
              ) {
                restored++
                changed = true
              }
            }
          } else if (
            await this.parseSessionFile(
              filePath,
              sessionId,
              agent.id,
              projectPath,
              channel,
              { fileStat: stat }
            )
          ) {
            parsed++
            changed = true
          }

          checked++
          if (checked % BACKGROUND_SESSION_REFRESH_YIELD_EVERY === 0) {
            await this.yieldToEventLoop()
            if (generation !== this.refreshGeneration || !this.initialized) {
              return
            }
          }
        }
      }

      if (generation !== this.refreshGeneration || !this.initialized) {
        return
      }

      const removed = this.removeMissingSessionFiles(
        activeFileKeys,
        new Set(agents.map((agent) => agent.id))
      )
      if (changed || removed) {
        this.markDirty()
        broadcastCostsUpdated()
      }

      if ((parsed > 0 || restored > 0 || removed) && !isProduction) {
        console.log(
          `Analytics session cache refreshed: ${parsed} parsed, ${restored} restored, ${removed ? 'stale entries removed' : 'no stale entries'}`
        )
      }

      this.analyticsStatus = 'ready'
      this.hasCompletedScan = true
      this.lastScanCompletedAt = new Date().toISOString()
      this.lastScanError = undefined
    } catch (error) {
      this.analyticsStatus = 'error'
      this.lastScanError = {
        code: this.hasCompletedScan ? 'SCAN_FAILED' : 'INITIAL_SCAN_FAILED',
        message: 'Analytics data scan failed',
      }
      console.error(
        'Failed to refresh analytics sessions in background:',
        error
      )
    }
  }

  private async parseSessionFile(
    filePath: string,
    sessionId: string,
    agentId: string,
    projectPath: string,
    channel?: string,
    options: ParseSessionFileOptions = {}
  ): Promise<boolean> {
    if (this.parsingFiles.has(filePath)) {
      const agent = this.agents.get(agentId)
      if (agent) {
        this.scheduleBackgroundSessionRefresh(
          this.activeOpenClawPath,
          [agent],
          this.refreshGeneration
        )
      }
      return false
    }
    if (!fs.existsSync(filePath)) {
      return false
    }

    const initialStat = options.fileStat ?? this.safeStat(filePath)
    if (!initialStat) return false
    const pricingRevision = this.pricingRevision
    this.parsingFiles.add(filePath)

    try {
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
      }

      let parsingErrors = 0
      const outboundCalls: OutboundCallInput[] = []
      const input = fs.createReadStream(filePath, { encoding: 'utf8' })
      const lines = readline.createInterface({ input, crlfDelay: Infinity })
      let lineNumber = 0
      for await (const line of lines) {
        if (!line.trim()) continue

        try {
          let entry: OpenClawLogEntry
          try {
            entry = JSON.parse(line) as OpenClawLogEntry
          } catch {
            parsingErrors++
            continue
          }
          const result = parseOpenClawEntry(entry, sessionId, agentId)
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
            })
            session.totalCost += result.cost
            session.totalInputTokens += result.inputTokens
            session.totalOutputTokens += result.outputTokens
            if (result.model && result.model !== 'unknown') {
              session.modelsUsed.add(result.model)
            }
            if (!session.startedAt || result.timestamp < session.startedAt) {
              session.startedAt = result.timestamp
            }
            if (
              !session.lastActivity ||
              result.timestamp > session.lastActivity
            ) {
              session.lastActivity = result.timestamp
            }
          }

          // Track tool calls from content blocks (reuses the parsed entry,
          // avoiding a second JSON.parse per line). Outbound calls are
          // collected and flushed in a single transaction at end-of-file.
          const calls = this.processLineForTools(
            entry,
            sessionId,
            agentId,
            session
          )
          outboundCalls.push(...calls)
        } catch {
          parsingErrors++
        }

        lineNumber++
        if (lineNumber % PARSE_YIELD_LINES === 0) {
          await this.yieldToEventLoop()
        }
      }

      const finalStat = this.safeStat(filePath)
      if (
        !finalStat ||
        finalStat.size !== initialStat.size ||
        Math.abs(finalStat.mtimeMs - initialStat.mtimeMs) >= 1
      ) {
        const agent = this.agents.get(agentId)
        if (agent) {
          this.scheduleBackgroundSessionRefresh(
            this.activeOpenClawPath,
            [agent],
            this.refreshGeneration
          )
        }
        return false
      }

      if (outboundCalls.length > 0) {
        try {
          logOutboundCalls(outboundCalls)
        } catch {
          // Logging failures must not abort the analytics parse.
        }
      }

      if (parsingErrors > 0 && !isProduction) {
        console.warn(`Found ${parsingErrors} parsing errors in ${filePath}`)
      }

      // Fallback timestamps
      if (!session.startedAt) {
        try {
          const stat = fs.statSync(filePath)
          session.startedAt = stat.birthtime.toISOString()
        } catch {
          session.startedAt = new Date().toISOString()
        }
      }
      if (!session.lastActivity) {
        session.lastActivity = session.startedAt
      }

      this.sessions.set(sessionId, session)
      this.sessionFileKeys.set(sessionId, this.getFileCacheKey(filePath))

      if (options.updateCache !== false) {
        const stat = options.fileStat ?? this.safeStat(filePath)
        if (stat) {
          this.updateSessionCache(
            filePath,
            sessionId,
            agentId,
            projectPath,
            channel,
            stat,
            session,
            pricingRevision
          )
        }
      }

      return true
    } catch (error) {
      if (!isProduction) {
        console.error(`Error parsing session file ${filePath}:`, error)
      }
      return false
    } finally {
      this.parsingFiles.delete(filePath)
    }
  }

  private processLineForTools(
    entry: OpenClawLogEntry,
    sessionId: string,
    agentId: string,
    session: SessionData
  ): OutboundCallInput[] {
    const calls: OutboundCallInput[] = []
    // Extract tool_use from content blocks
    const message = entry.message
    if (message && Array.isArray(message.content)) {
      for (const block of message.content as Array<Record<string, unknown>>) {
        try {
          if (
            block.type === 'tool_use' &&
            typeof block.name === 'string' &&
            typeof block.id === 'string'
          ) {
            const pending: PendingToolCall = {
              sessionId,
              agentId,
              toolName: block.name,
              toolUseId: block.id,
              timestamp: entry.timestamp || new Date().toISOString(),
              startTime: Date.now(),
            }
            this.pendingToolCalls.set(block.id, pending)

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
            })
          }
          if (
            block.type === 'tool_result' &&
            typeof block.tool_use_id === 'string'
          ) {
            const pending = this.pendingToolCalls.get(block.tool_use_id)
            if (pending) {
              const durationMs = Date.now() - pending.startTime
              const isError = Boolean(block.is_error)

              // Update the tool call in session
              const tc = session.toolCalls.find(
                (t) => t.toolUseId === block.tool_use_id
              )
              if (tc) {
                tc.durationMs = durationMs
                tc.status = isError ? 'error' : 'success'
                tc.error = isError ? 'Tool execution failed' : null
              }

              // Collect for batched transaction write at end-of-file.
              calls.push({
                session_id: sessionId,
                agent_id: agentId,
                tool_name: pending.toolName,
                tool_use_id: pending.toolUseId,
                duration_ms: durationMs,
                status: isError ? 'error' : 'success',
                error: isError ? 'Tool execution failed' : null,
              })

              this.pendingToolCalls.delete(block.tool_use_id)
            }
          }
        } catch {
          // Continue processing other blocks
        }
      }
    }
    return calls
  }

  private cleanupStalePendingCalls(): void {
    const now = Date.now()
    for (const [id, pending] of this.pendingToolCalls) {
      if (now - pending.startTime > 300000) {
        logOutboundCall({
          session_id: pending.sessionId,
          agent_id: pending.agentId,
          tool_name: pending.toolName,
          duration_ms: now - pending.startTime,
          status: 'timeout',
          error: 'Tool call timed out without result',
        })
        this.pendingToolCalls.delete(id)
      }
    }
  }

  private markDirty(): void {
    this._dailyCosts = null
    this._modelUsage = null
    this._statsCache = null
  }

  private debouncedBudgetCheck(): void {
    if (this.budgetCheckTimeout) {
      clearTimeout(this.budgetCheckTimeout)
    }
    this.budgetCheckTimeout = setTimeout(async () => {
      try {
        // Dynamic imports to avoid circular dependency
        const { checkBudgets } = await import('./budget-checker.js')
        const { detectAnomalies } = await import('./anomaly-detector.js')
        checkBudgets()
        detectAnomalies()
      } catch {
        // Budget check failures should not break the app
      }
      broadcastCostsUpdated()
    }, 5000)
  }

  // ============================================
  // Helpers
  // ============================================

  private allRequests(): Array<
    ParsedRequest & { sessionId: string; agentId: string; channel?: string }
  > {
    const result: Array<
      ParsedRequest & { sessionId: string; agentId: string; channel?: string }
    > = []
    for (const [, session] of this.sessions) {
      for (const req of session.requests) {
        result.push({
          ...req,
          sessionId: session.id,
          agentId: session.agentId,
          channel: session.channel,
        })
      }
    }
    return result
  }

  private dateStr(iso: string): string {
    const date = new Date(iso)
    if (Number.isNaN(date.getTime())) {
      return iso.split('T')[0]
    }
    return this.formatLocalDate(date)
  }

  private today(): string {
    return this.formatLocalDate(new Date())
  }

  private daysAgo(days: number): string {
    const d = new Date()
    d.setDate(d.getDate() - days)
    return this.formatLocalDate(d)
  }

  /** Inclusive local-calendar start for a window containing today. */
  private lastNDaysStart(days: number): string {
    const normalized = Number.isFinite(days) ? Math.max(1, Math.floor(days)) : 1
    return this.daysAgo(normalized - 1)
  }

  private formatLocalDate(date: Date): string {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
      date.getDate()
    ).padStart(2, '0')}`
  }

  private startOfMonth(): string {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
  }

  private startOfWeek(): string {
    const d = new Date()
    const daysSinceMonday = (d.getDay() + 6) % 7
    d.setDate(d.getDate() - daysSinceMonday)
    return this.formatLocalDate(d)
  }

  private lastMonthStr(): string {
    const d = new Date()
    d.setMonth(d.getMonth() - 1)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  }

  // ============================================
  // Session queries (matching queries.ts)
  // ============================================

  getSession(id: string): Session | undefined {
    const s = this.sessions.get(id)
    if (!s) return undefined
    return {
      id: s.id,
      project_path: s.projectPath,
      started_at: s.startedAt,
      last_activity: s.lastActivity,
      total_input_tokens: s.totalInputTokens,
      total_output_tokens: s.totalOutputTokens,
      total_cost: s.totalCost,
      models_used: [...s.modelsUsed],
    }
  }

  getSessions(limit = 100, offset = 0): Session[] {
    const all = [...this.sessions.values()].sort((a, b) =>
      b.lastActivity.localeCompare(a.lastActivity)
    )
    return all.slice(offset, offset + limit).map((s) => ({
      id: s.id,
      project_path: s.projectPath,
      started_at: s.startedAt,
      last_activity: s.lastActivity,
      total_input_tokens: s.totalInputTokens,
      total_output_tokens: s.totalOutputTokens,
      total_cost: s.totalCost,
      models_used: [...s.modelsUsed],
    }))
  }

  getSessionCount(): number {
    return this.sessions.size
  }

  getRequests(sessionId: string): Request[] {
    const s = this.sessions.get(sessionId)
    if (!s) return []
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
    }))
  }

  // ============================================
  // Daily cost queries
  // ============================================

  getDailyCosts(days = 30): DailyCost[] {
    if (!this._dailyCosts) {
      this._dailyCosts = this.computeDailyCosts()
    }
    const cutoff = this.lastNDaysStart(days)
    return [...this._dailyCosts.values()]
      .filter((day) => day.date >= cutoff && day.date <= this.today())
      .sort((a, b) => a.date.localeCompare(b.date))
  }

  private computeDailyCosts(): Map<string, DailyCost> {
    const dayMap = new Map<string, DailyCost>()
    const sessionDates = new Map<string, Set<string>>() // date -> set of session IDs

    for (const [, session] of this.sessions) {
      for (const req of session.requests) {
        const date = this.dateStr(req.timestamp)

        let day = dayMap.get(date)
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
          }
          dayMap.set(date, day)
          sessionDates.set(date, new Set())
        }

        day.total_cost += req.cost
        day.total_input_tokens += req.inputTokens
        day.total_output_tokens += req.outputTokens
        day.cache_creation_tokens += req.cacheCreationTokens
        day.cache_read_tokens += req.cacheReadTokens
        day.cache_savings += req.cacheSavings
        day.request_count++

        sessionDates.get(date)!.add(session.id)
      }
    }

    // Set session counts
    for (const [date, day] of dayMap) {
      day.session_count = sessionDates.get(date)!.size
    }

    return dayMap
  }

  private computeAggregatedStats(): AggregatedStats {
    const today = this.today()
    const weekCutoff = this.startOfWeek()
    const monthStart = this.startOfMonth()

    const stats: AggregatedStats = {
      todaySpend: 0,
      todayInput: 0,
      todayOutput: 0,
      weekSpend: 0,
      monthSpend: 0,
      totalCost: 0,
      totalInput: 0,
      totalOutput: 0,
      totalCacheRead: 0,
      totalCacheCreation: 0,
      totalCacheSavings: 0,
      activeThisMonth: 0,
    }

    for (const [, session] of this.sessions) {
      if (
        session.lastActivity >= monthStart &&
        session.lastActivity <= new Date().toISOString()
      ) {
        stats.activeThisMonth++
      }

      for (const req of session.requests) {
        const date = this.dateStr(req.timestamp)

        if (date > today) continue

        stats.totalCost += req.cost
        stats.totalInput += req.inputTokens
        stats.totalOutput += req.outputTokens
        stats.totalCacheRead += req.cacheReadTokens
        stats.totalCacheCreation += req.cacheCreationTokens
        stats.totalCacheSavings += req.cacheSavings

        if (date === today) {
          stats.todaySpend += req.cost
          stats.todayInput += req.inputTokens
          stats.todayOutput += req.outputTokens
        }
        if (date >= weekCutoff && date <= today) {
          stats.weekSpend += req.cost
        }
        if (date >= monthStart && date <= today) {
          stats.monthSpend += req.cost
        }
      }
    }

    return stats
  }

  private getStatsInternal(): AggregatedStats {
    const today = this.today()
    if (this._statsCache && this._statsCacheDate === today) {
      return this._statsCache
    }

    const stats = this.computeAggregatedStats()
    this._statsCache = stats
    this._statsCacheDate = today
    return stats
  }

  getTodayCost(): number {
    return this.getStatsInternal().todaySpend
  }

  getWeekCost(): number {
    return this.getStatsInternal().weekSpend
  }

  getMonthCost(): number {
    return this.getStatsInternal().monthSpend
  }

  // ============================================
  // Model usage queries
  // ============================================

  getModelUsage(days = 30): ModelUsage[] {
    if (!this._modelUsage) {
      this._modelUsage = this.computeModelUsageByDate()
    }
    const cutoff = this.lastNDaysStart(days)
    // Roll up per-day aggregates into per-model totals across the window.
    const modelMap = new Map<string, ModelUsage>()
    for (const [date, perModel] of this._modelUsage) {
      if (date < cutoff || date > this.today()) continue
      for (const m of perModel.values()) {
        let acc = modelMap.get(`${m.provider}/${m.model}`)
        if (!acc) {
          acc = {
            date: '',
            provider: m.provider,
            model: m.model,
            input_tokens: 0,
            output_tokens: 0,
            cost: 0,
            request_count: 0,
          }
          modelMap.set(`${m.provider}/${m.model}`, acc)
        }
        acc.input_tokens += m.input_tokens
        acc.output_tokens += m.output_tokens
        acc.cost += m.cost
        acc.request_count += m.request_count
      }
    }

    return [...modelMap.values()].sort((a, b) => b.cost - a.cost)
  }

  private computeModelUsageByDate(): Map<string, Map<string, ModelUsage>> {
    const byDate = new Map<string, Map<string, ModelUsage>>()

    for (const [, session] of this.sessions) {
      for (const req of session.requests) {
        const date = this.dateStr(req.timestamp)
        let perModel = byDate.get(date)
        if (!perModel) {
          perModel = new Map()
          byDate.set(date, perModel)
        }
        const key = `${req.provider}/${req.model}`
        let m = perModel.get(key)
        if (!m) {
          m = {
            date,
            provider: req.provider,
            model: req.model,
            input_tokens: 0,
            output_tokens: 0,
            cost: 0,
            request_count: 0,
          }
          perModel.set(key, m)
        }
        m.input_tokens += req.inputTokens
        m.output_tokens += req.outputTokens
        m.cost += req.cost
        m.request_count++
      }
    }

    return byDate
  }

  getModelUsageWithCache(days = 30): ModelUsageWithCache[] {
    const cutoff = this.lastNDaysStart(days)
    const modelMap = new Map<string, ModelUsageWithCache>()

    for (const [, session] of this.sessions) {
      for (const req of session.requests) {
        const date = this.dateStr(req.timestamp)
        if (date < cutoff || date > this.today()) continue
        const key = `${req.provider}/${req.model}`
        let m = modelMap.get(key)
        if (!m) {
          m = {
            provider: req.provider,
            model: req.model,
            inputTokens: 0,
            outputTokens: 0,
            cacheReadTokens: 0,
            cacheCreationTokens: 0,
            cost: 0,
            requestCount: 0,
          }
          modelMap.set(key, m)
        }
        m.inputTokens += req.inputTokens
        m.outputTokens += req.outputTokens
        m.cacheReadTokens += req.cacheReadTokens
        m.cacheCreationTokens += req.cacheCreationTokens
        m.cost += req.cost
        m.requestCount++
      }
    }

    return [...modelMap.values()].sort((a, b) => b.cost - a.cost)
  }

  // ============================================
  // Stats queries
  // ============================================

  getStats(): Stats {
    const stats = this.getStatsInternal()
    return {
      todaySpend: stats.todaySpend,
      weeklySpend: stats.weekSpend,
      monthlySpend: stats.monthSpend,
      totalSessions: this.sessions.size,
      todayTokens: { input: stats.todayInput, output: stats.todayOutput },
    }
  }

  getEnhancedStats(): EnhancedStats {
    const stats = this.getStatsInternal()

    return {
      totalCost: stats.totalCost,
      monthCost: stats.monthSpend,
      totalTokens: {
        input: stats.totalInput,
        output: stats.totalOutput,
        cacheRead: stats.totalCacheRead,
        cacheCreation: stats.totalCacheCreation,
      },
      cacheSavings: stats.totalCacheSavings,
      activeSessionsThisMonth: stats.activeThisMonth,
    }
  }

  getTokenBreakdown(days?: number): TokenBreakdown & { total: number } {
    const cutoff = days !== undefined ? this.lastNDaysStart(days) : ''
    const today = this.today()
    let input = 0,
      output = 0,
      cacheRead = 0,
      cacheCreation = 0

    for (const [, session] of this.sessions) {
      for (const req of session.requests) {
        const date = this.dateStr(req.timestamp)
        if (date > today || (cutoff && date < cutoff)) continue
        input += req.inputTokens
        output += req.outputTokens
        cacheRead += req.cacheReadTokens
        cacheCreation += req.cacheCreationTokens
      }
    }

    return {
      input,
      output,
      cacheRead,
      cacheCreation,
      total: input + output + cacheRead + cacheCreation,
    }
  }

  getTokenSummary(): TokenSummary {
    const lifetime = this.createTokenPeriodSummary()
    const last5Hours = this.createTokenPeriodSummary()
    const last7Days = this.createTokenPeriodSummary()
    const last30Days = this.createTokenPeriodSummary()
    const now = Date.now()
    const fiveHoursCutoff = now - 5 * 60 * 60 * 1000
    const sevenDaysCutoff = now - 7 * 24 * 60 * 60 * 1000
    const thirtyDaysCutoff = now - 30 * 24 * 60 * 60 * 1000

    for (const [, session] of this.sessions) {
      for (const req of session.requests) {
        const timestamp = new Date(req.timestamp).getTime()
        if (Number.isFinite(timestamp) && timestamp > now) continue
        this.addRequestToTokenPeriod(lifetime, req)

        if (
          Number.isFinite(timestamp) &&
          timestamp >= fiveHoursCutoff &&
          timestamp <= now
        ) {
          this.addRequestToTokenPeriod(last5Hours, req)
        }

        if (
          Number.isFinite(timestamp) &&
          timestamp >= sevenDaysCutoff &&
          timestamp <= now
        ) {
          this.addRequestToTokenPeriod(last7Days, req)
        }
        if (
          Number.isFinite(timestamp) &&
          timestamp >= thirtyDaysCutoff &&
          timestamp <= now
        ) {
          this.addRequestToTokenPeriod(last30Days, req)
        }
      }
    }

    return { lifetime, last5Hours, last7Days, last30Days }
  }

  private createTokenPeriodSummary(): TokenPeriodSummary {
    return {
      total: 0,
      input: 0,
      output: 0,
      cacheRead: 0,
      cacheCreation: 0,
      cost: 0,
    }
  }

  private addRequestToTokenPeriod(
    summary: TokenPeriodSummary,
    req: ParsedRequest
  ): void {
    summary.input += req.inputTokens
    summary.output += req.outputTokens
    summary.cacheRead += req.cacheReadTokens
    summary.cacheCreation += req.cacheCreationTokens
    summary.total +=
      req.inputTokens +
      req.outputTokens +
      req.cacheReadTokens +
      req.cacheCreationTokens
    summary.cost += req.cost
  }

  // ============================================
  // Cost summary
  // ============================================

  getCostSummary(): CostSummary {
    const today = this.today()
    const monthStart = this.startOfMonth()
    const lastMonthStr = this.lastMonthStr()

    const lifetime: PeriodSummary = {
      totalCost: 0,
      inputTokens: 0,
      outputTokens: 0,
      cacheReadTokens: 0,
      cacheCreationTokens: 0,
      cacheSavings: 0,
      sessionCount: 0,
    }
    const thisMonth: PeriodSummary = {
      totalCost: 0,
      inputTokens: 0,
      outputTokens: 0,
      cacheReadTokens: 0,
      cacheCreationTokens: 0,
      cacheSavings: 0,
      sessionCount: 0,
    }
    const lastMonth: PeriodSummary = {
      totalCost: 0,
      inputTokens: 0,
      outputTokens: 0,
      cacheReadTokens: 0,
      cacheCreationTokens: 0,
      cacheSavings: 0,
      sessionCount: 0,
    }
    const todayPeriod: PeriodSummary = {
      totalCost: 0,
      inputTokens: 0,
      outputTokens: 0,
      cacheReadTokens: 0,
      cacheCreationTokens: 0,
      cacheSavings: 0,
      sessionCount: 0,
    }

    // Track unique sessions per period via dates
    const lifetimeSessions = new Set<string>()
    const thisMonthSessions = new Set<string>()
    const lastMonthSessions = new Set<string>()
    const todaySessions = new Set<string>()

    for (const [, session] of this.sessions) {
      for (const req of session.requests) {
        const date = this.dateStr(req.timestamp)
        if (date > today) continue
        const ym = date.substring(0, 7)

        // Lifetime
        lifetime.totalCost += req.cost
        lifetime.inputTokens += req.inputTokens
        lifetime.outputTokens += req.outputTokens
        lifetime.cacheReadTokens += req.cacheReadTokens
        lifetime.cacheCreationTokens += req.cacheCreationTokens
        lifetime.cacheSavings += req.cacheSavings
        lifetimeSessions.add(session.id)

        // This month
        if (date >= monthStart && date <= today) {
          thisMonth.totalCost += req.cost
          thisMonth.inputTokens += req.inputTokens
          thisMonth.outputTokens += req.outputTokens
          thisMonth.cacheReadTokens += req.cacheReadTokens
          thisMonth.cacheCreationTokens += req.cacheCreationTokens
          thisMonth.cacheSavings += req.cacheSavings
          thisMonthSessions.add(session.id)
        }

        // Last month
        if (ym === lastMonthStr) {
          lastMonth.totalCost += req.cost
          lastMonth.inputTokens += req.inputTokens
          lastMonth.outputTokens += req.outputTokens
          lastMonth.cacheReadTokens += req.cacheReadTokens
          lastMonth.cacheCreationTokens += req.cacheCreationTokens
          lastMonth.cacheSavings += req.cacheSavings
          lastMonthSessions.add(session.id)
        }

        // Today
        if (date === today) {
          todayPeriod.totalCost += req.cost
          todayPeriod.inputTokens += req.inputTokens
          todayPeriod.outputTokens += req.outputTokens
          todayPeriod.cacheReadTokens += req.cacheReadTokens
          todayPeriod.cacheCreationTokens += req.cacheCreationTokens
          todayPeriod.cacheSavings += req.cacheSavings
          todaySessions.add(session.id)
        }
      }
    }

    lifetime.sessionCount = lifetimeSessions.size
    thisMonth.sessionCount = thisMonthSessions.size
    lastMonth.sessionCount = lastMonthSessions.size
    todayPeriod.sessionCount = todaySessions.size

    return { lifetime, thisMonth, lastMonth, today: todayPeriod }
  }

  getCacheSavings(days?: number): CacheSavingsDetail {
    const cutoff = days !== undefined ? this.lastNDaysStart(days) : ''
    const today = this.today()
    let savings = 0,
      cacheRead = 0,
      cacheCreation = 0,
      totalCost = 0

    for (const [, session] of this.sessions) {
      for (const req of session.requests) {
        const date = this.dateStr(req.timestamp)
        if (date > today || (cutoff && date < cutoff)) continue
        savings += req.cacheSavings
        cacheRead += req.cacheReadTokens
        cacheCreation += req.cacheCreationTokens
        totalCost += req.cost
      }
    }

    const potentialCost = totalCost + savings
    const savingsPercentage =
      potentialCost > 0 ? (savings / potentialCost) * 100 : 0

    return {
      totalSavings: savings,
      cacheReadTokens: cacheRead,
      cacheCreationTokens: cacheCreation,
      savingsPercentage: Math.round(savingsPercentage * 100) / 100,
    }
  }

  // ============================================
  // Model stats for Models page
  // ============================================

  getModelStats(days = 30): ModelStats {
    const usage = this.getModelUsage(days)
    const providers = new Set(usage.map((m) => m.provider))

    const topModel =
      usage.length > 0
        ? {
            provider: usage[0].provider,
            model: usage[0].model,
            cost: usage[0].cost,
          }
        : null

    // Provider summary
    const providerCosts = new Map<
      string,
      { cost: number; models: Set<string> }
    >()
    for (const m of usage) {
      let p = providerCosts.get(m.provider)
      if (!p) {
        p = { cost: 0, models: new Set() }
        providerCosts.set(m.provider, p)
      }
      p.cost += m.cost
      p.models.add(m.model)
    }
    let topProvider: {
      provider: string
      cost: number
      modelCount: number
    } | null = null
    for (const [provider, data] of providerCosts) {
      if (!topProvider || data.cost > topProvider.cost) {
        topProvider = {
          provider,
          cost: data.cost,
          modelCount: data.models.size,
        }
      }
    }

    return {
      totalModels: usage.length,
      totalProviders: providers.size,
      topModel,
      topProvider,
    }
  }

  getModelDailyUsage(days = 30): ModelDailyUsage[] {
    const cutoff = this.lastNDaysStart(days)
    const dayModelMap = new Map<string, ModelDailyUsage>()

    for (const [, session] of this.sessions) {
      for (const req of session.requests) {
        const date = this.dateStr(req.timestamp)
        if (date < cutoff || date > this.today()) continue
        const key = `${date}/${req.provider}/${req.model}`
        let m = dayModelMap.get(key)
        if (!m) {
          m = {
            date,
            provider: req.provider,
            model: req.model,
            inputTokens: 0,
            outputTokens: 0,
            cost: 0,
            requestCount: 0,
          }
          dayModelMap.set(key, m)
        }
        m.inputTokens += req.inputTokens
        m.outputTokens += req.outputTokens
        m.cost += req.cost
        m.requestCount++
      }
    }

    return [...dayModelMap.values()].sort(
      (a, b) => b.date.localeCompare(a.date) || b.cost - a.cost
    )
  }

  getProviderSummary(days = 30): ProviderSummary[] {
    const usage = this.getModelUsage(days)
    const providerMap = new Map<string, ProviderSummary>()

    for (const m of usage) {
      let p = providerMap.get(m.provider)
      if (!p) {
        p = {
          provider: m.provider,
          totalCost: 0,
          totalInputTokens: 0,
          totalOutputTokens: 0,
          modelCount: 0,
          requestCount: 0,
        }
        providerMap.set(m.provider, p)
      }
      p.totalCost += m.cost
      p.totalInputTokens += m.input_tokens
      p.totalOutputTokens += m.output_tokens
      p.modelCount++
      p.requestCount += m.request_count
    }

    return [...providerMap.values()].sort((a, b) => b.totalCost - a.totalCost)
  }

  // ============================================
  // Weekly trend
  // ============================================

  getWeeklyTrend(): WeeklyTrend {
    const thisWeekCutoff = this.daysAgo(6)
    const lastWeekStart = this.daysAgo(13)
    const lastWeekEnd = this.daysAgo(7) // exclusive

    let twCost = 0,
      twTokens = 0
    const twSessions = new Set<string>()
    let lwCost = 0,
      lwTokens = 0
    const lwSessions = new Set<string>()

    for (const [, session] of this.sessions) {
      for (const req of session.requests) {
        const date = this.dateStr(req.timestamp)
        if (date >= thisWeekCutoff && date <= this.today()) {
          twCost += req.cost
          twTokens += req.inputTokens + req.outputTokens
          twSessions.add(session.id)
        } else if (date >= lastWeekStart && date < lastWeekEnd) {
          lwCost += req.cost
          lwTokens += req.inputTokens + req.outputTokens
          lwSessions.add(session.id)
        }
      }
    }

    const changePercent =
      lwCost > 0
        ? Math.round(((twCost - lwCost) / lwCost) * 10000) / 100
        : twCost > 0
          ? 100
          : 0

    return {
      thisWeek: { cost: twCost, tokens: twTokens, sessions: twSessions.size },
      lastWeek: { cost: lwCost, tokens: lwTokens, sessions: lwSessions.size },
      changePercent,
    }
  }

  // ============================================
  // Session analytics
  // ============================================

  getSessionStats(): SessionStats {
    const monthStart = this.startOfMonth()
    let totalCost = 0
    let monthSessions = 0
    const projectCounts = new Map<string, number>()

    for (const [, session] of this.sessions) {
      totalCost += session.totalCost
      if (session.lastActivity >= monthStart) monthSessions++
      projectCounts.set(
        session.projectPath,
        (projectCounts.get(session.projectPath) || 0) + 1
      )
    }

    let mostActiveProject: { project: string; sessionCount: number } | null =
      null
    for (const [project, count] of projectCounts) {
      if (!mostActiveProject || count > mostActiveProject.sessionCount) {
        mostActiveProject = { project, sessionCount: count }
      }
    }

    const total = this.sessions.size
    return {
      totalSessions: total,
      totalSessionsThisMonth: monthSessions,
      totalCost,
      avgCostPerSession: total > 0 ? totalCost / total : 0,
      mostActiveProject,
    }
  }

  getProjectBreakdown(limit = 10): ProjectBreakdown[] {
    const projectMap = new Map<string, ProjectBreakdown>()

    for (const [, session] of this.sessions) {
      let p = projectMap.get(session.projectPath)
      if (!p) {
        p = {
          project: session.projectPath,
          totalCost: 0,
          totalInputTokens: 0,
          totalOutputTokens: 0,
          sessionCount: 0,
        }
        projectMap.set(session.projectPath, p)
      }
      p.totalCost += session.totalCost
      p.totalInputTokens += session.totalInputTokens
      p.totalOutputTokens += session.totalOutputTokens
      p.sessionCount++
    }

    return [...projectMap.values()]
      .sort((a, b) => b.totalCost - a.totalCost)
      .slice(0, limit)
  }

  getEnhancedSessions(options: EnhancedSessionsOptions = {}): {
    sessions: EnhancedSession[]
    total: number
  } {
    const {
      limit = 50,
      offset = 0,
      sortBy = 'last_activity',
      sortDir = 'desc',
      project,
      model,
      search,
    } = options

    let filtered = [...this.sessions.values()]

    if (project) {
      filtered = filtered.filter((s) => s.projectPath === project)
    }
    if (model) {
      filtered = filtered.filter(
        (s) =>
          s.modelsUsed.has(model) ||
          [...s.modelsUsed].some((m) => m.includes(model))
      )
    }
    if (search) {
      const q = search.toLowerCase()
      filtered = filtered.filter(
        (s) =>
          s.projectPath.toLowerCase().includes(q) ||
          [...s.modelsUsed].some((m) => m.toLowerCase().includes(q))
      )
    }

    const total = filtered.length

    // Sort
    const dir = sortDir === 'asc' ? 1 : -1
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'total_cost':
          return (a.totalCost - b.totalCost) * dir
        case 'total_input_tokens':
          return (a.totalInputTokens - b.totalInputTokens) * dir
        case 'total_output_tokens':
          return (a.totalOutputTokens - b.totalOutputTokens) * dir
        case 'request_count':
          return (a.requests.length - b.requests.length) * dir
        case 'last_activity':
        default:
          return a.lastActivity.localeCompare(b.lastActivity) * dir
      }
    })

    const page = filtered.slice(offset, offset + limit)

    const sessions: EnhancedSession[] = page.map((s) => ({
      id: s.id,
      project_path: s.projectPath,
      started_at: s.startedAt,
      last_activity: s.lastActivity,
      total_input_tokens: s.totalInputTokens,
      total_output_tokens: s.totalOutputTokens,
      total_cost: s.totalCost,
      models_used: [...s.modelsUsed],
      request_count: s.requests.length,
    }))

    return { sessions, total }
  }

  getDistinctProjects(): string[] {
    const projects = new Set<string>()
    for (const [, session] of this.sessions) {
      projects.add(session.projectPath)
    }
    return [...projects].sort()
  }

  getDistinctModels(): string[] {
    const models = new Set<string>()
    for (const [, session] of this.sessions) {
      for (const req of session.requests) {
        models.add(req.model)
      }
    }
    return [...models].sort()
  }

  // ============================================
  // Agent queries (matching queries-agents.ts)
  // ============================================

  getAgents(): Agent[] {
    const agentMap = new Map<string, Agent>()

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
      })
    }

    for (const [, session] of this.sessions) {
      let a = agentMap.get(session.agentId)
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
        }
        agentMap.set(session.agentId, a)
      }
      a.total_cost += session.totalCost
      a.total_input_tokens += session.totalInputTokens
      a.total_output_tokens += session.totalOutputTokens
      a.session_count++
    }

    return [...agentMap.values()].sort((a, b) => b.total_cost - a.total_cost)
  }

  getAgent(id: string): Agent | undefined {
    return this.getAgents().find((a) => a.id === id)
  }

  getAgentDailyCosts(agentId: string, days = 30): AgentDailyCost[] {
    const cutoff = this.lastNDaysStart(days)
    const dayMap = new Map<string, AgentDailyCost>()

    for (const [, session] of this.sessions) {
      if (session.agentId !== agentId) continue
      for (const req of session.requests) {
        const date = this.dateStr(req.timestamp)
        if (date < cutoff || date > this.today()) continue
        let d = dayMap.get(date)
        if (!d) {
          d = {
            agent_id: agentId,
            date,
            total_cost: 0,
            input_tokens: 0,
            output_tokens: 0,
            cache_read_tokens: 0,
            cache_creation_tokens: 0,
            request_count: 0,
          }
          dayMap.set(date, d)
        }
        d.total_cost += req.cost
        d.input_tokens += req.inputTokens
        d.output_tokens += req.outputTokens
        d.cache_read_tokens += req.cacheReadTokens
        d.cache_creation_tokens += req.cacheCreationTokens
        d.request_count++
      }
    }

    return [...dayMap.values()].sort((a, b) => a.date.localeCompare(b.date))
  }

  getAllAgentsDailyCosts(days = 30): AgentDailyCost[] {
    const cutoff = this.lastNDaysStart(days)
    const dayMap = new Map<string, AgentDailyCost>()

    for (const [, session] of this.sessions) {
      for (const req of session.requests) {
        const date = this.dateStr(req.timestamp)
        if (date < cutoff || date > this.today()) continue
        const key = `${session.agentId}/${date}`
        let d = dayMap.get(key)
        if (!d) {
          d = {
            agent_id: session.agentId,
            date,
            total_cost: 0,
            input_tokens: 0,
            output_tokens: 0,
            cache_read_tokens: 0,
            cache_creation_tokens: 0,
            request_count: 0,
          }
          dayMap.set(key, d)
        }
        d.total_cost += req.cost
        d.input_tokens += req.inputTokens
        d.output_tokens += req.outputTokens
        d.cache_read_tokens += req.cacheReadTokens
        d.cache_creation_tokens += req.cacheCreationTokens
        d.request_count++
      }
    }

    return [...dayMap.values()].sort((a, b) => a.date.localeCompare(b.date))
  }

  getAgentStatsResult(limit = 50): AgentStatsResult {
    const agents = this.getAgents().slice(0, limit)
    let totalCost = 0,
      totalSessions = 0
    for (const a of agents) {
      totalCost += a.total_cost
      totalSessions += a.session_count
    }
    return { agents, totalCost, totalSessions }
  }

  // ============================================
  // Channel queries (matching queries-agents.ts)
  // ============================================

  getChannels(): Channel[] {
    const channelMap = new Map<string, Channel>()
    let nextId = 1

    for (const [, session] of this.sessions) {
      const channelName = session.channel || 'default'
      let ch = channelMap.get(channelName)
      if (!ch) {
        ch = {
          id: nextId++,
          name: channelName,
          total_cost: 0,
          total_input_tokens: 0,
          total_output_tokens: 0,
          message_count: 0,
        }
        channelMap.set(channelName, ch)
      }
      ch.total_cost += session.totalCost
      ch.total_input_tokens += session.totalInputTokens
      ch.total_output_tokens += session.totalOutputTokens
      ch.message_count += session.requests.length
    }

    return [...channelMap.values()].sort((a, b) => b.total_cost - a.total_cost)
  }

  getChannel(id: number): Channel | undefined {
    return this.getChannels().find((c) => c.id === id)
  }

  getChannelByName(name: string): Channel | undefined {
    return this.getChannels().find((c) => c.name === name)
  }

  getChannelDailyCosts(channelId: number, days = 30): ChannelDailyCost[] {
    const channel = this.getChannel(channelId)
    if (!channel) return []
    return this.getChannelDailyCostsByName(channel.name, days, channelId)
  }

  private getChannelDailyCostsByName(
    channelName: string,
    days: number,
    channelId: number
  ): ChannelDailyCost[] {
    const cutoff = this.lastNDaysStart(days)
    const dayMap = new Map<string, ChannelDailyCost>()

    for (const [, session] of this.sessions) {
      if ((session.channel || 'default') !== channelName) continue
      for (const req of session.requests) {
        const date = this.dateStr(req.timestamp)
        if (date < cutoff || date > this.today()) continue
        let d = dayMap.get(date)
        if (!d) {
          d = {
            channel_id: channelId,
            date,
            total_cost: 0,
            input_tokens: 0,
            output_tokens: 0,
            message_count: 0,
          }
          dayMap.set(date, d)
        }
        d.total_cost += req.cost
        d.input_tokens += req.inputTokens
        d.output_tokens += req.outputTokens
        d.message_count++
      }
    }

    return [...dayMap.values()].sort((a, b) => a.date.localeCompare(b.date))
  }

  getAllChannelsDailyCosts(days = 30): ChannelDailyCost[] {
    const channels = this.getChannels()
    const result: ChannelDailyCost[] = []
    for (const ch of channels) {
      result.push(...this.getChannelDailyCostsByName(ch.name, days, ch.id))
    }
    return result.sort((a, b) => a.date.localeCompare(b.date))
  }

  getChannelStatsResult(limit = 50): ChannelStatsResult {
    const channels = this.getChannels().slice(0, limit)
    let totalCost = 0,
      totalMessages = 0
    for (const ch of channels) {
      totalCost += ch.total_cost
      totalMessages += ch.message_count
    }
    return { channels, totalCost, totalMessages }
  }
}

// ============================================
// Singleton
// ============================================

let instance: AnalyticsService | null = null

export function getAnalyticsService(): AnalyticsService {
  if (!instance) {
    instance = new AnalyticsService()
  }
  return instance
}

export function initializeAnalyticsService(
  openClawPath?: string
): AnalyticsService {
  const service = getAnalyticsService()
  service.initialize(openClawPath)
  return service
}

export async function shutdownAnalyticsService(): Promise<void> {
  if (instance) {
    await instance.shutdown()
    instance = null
  }
}
