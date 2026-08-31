import type { ParsedRequest, ToolCallData } from './domain.js'

export const SESSION_CACHE_VERSION = 5
export const PREVIOUS_SESSION_CACHE_VERSION = 4
export const LEGACY_SESSION_CACHE_VERSION = 3

export interface SerializedSessionData {
  id: string
  rawSessionId?: string
  sourceType?: 'openclaw' | 'hermes'
  usageGranularity?: 'request' | 'aggregate'
  agentId: string
  projectPath: string
  startedAt: string
  lastActivity: string
  channel?: string
  requests: ParsedRequest[]
  totalCost: number
  totalInputTokens: number
  totalOutputTokens: number
  totalReasoningTokens?: number
  apiCallCount?: number
  costCurrency?: 'CNY'
  costStatus?: 'reported' | 'estimated' | 'unknown'
  costSource?: string
  modelsUsed: string[]
  toolCalls: ToolCallData[]
}

export interface CachedSessionEntry {
  filePath: string
  sessionId: string
  agentId: string
  projectPath: string
  channel?: string
  size: number
  mtimeMs: number
  parsedAt: string
  pricingRevision?: string | number
  session: SerializedSessionData
  lastSeq?: number
  lastEventFingerprint?: string
}

export interface SessionCacheFile {
  version: number
  openClawPath: string
  pricingFingerprint?: string
  lastSuccessfulScanAt?: string
  entries: CachedSessionEntry[]
}

export function normalizeCachedEntry(
  value: unknown,
  now = new Date()
): CachedSessionEntry | null {
  if (!value || typeof value !== 'object') return null

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

  const fallbackTimestamp = now.toISOString()
  return {
    filePath: entry.filePath,
    sessionId: entry.sessionId,
    agentId: entry.agentId,
    projectPath: entry.projectPath,
    channel: typeof entry.channel === 'string' ? entry.channel : undefined,
    size: entry.size,
    mtimeMs: entry.mtimeMs,
    parsedAt:
      typeof entry.parsedAt === 'string' ? entry.parsedAt : fallbackTimestamp,
    ...(typeof entry.lastSeq === 'number' &&
    Number.isSafeInteger(entry.lastSeq) &&
    entry.lastSeq >= 0
      ? { lastSeq: entry.lastSeq }
      : {}),
    ...(typeof entry.lastEventFingerprint === 'string'
      ? { lastEventFingerprint: entry.lastEventFingerprint }
      : {}),
    ...(typeof entry.pricingRevision === 'string' ||
    (typeof entry.pricingRevision === 'number' &&
      Number.isSafeInteger(entry.pricingRevision))
      ? { pricingRevision: entry.pricingRevision }
      : {}),
    session: {
      id: session.id,
      rawSessionId:
        typeof session.rawSessionId === 'string'
          ? session.rawSessionId
          : session.id,
      sourceType: session.sourceType === 'hermes' ? 'hermes' : 'openclaw',
      usageGranularity:
        session.usageGranularity === 'aggregate' ? 'aggregate' : 'request',
      agentId: session.agentId,
      projectPath: session.projectPath,
      startedAt:
        typeof session.startedAt === 'string'
          ? session.startedAt
          : fallbackTimestamp,
      lastActivity:
        typeof session.lastActivity === 'string'
          ? session.lastActivity
          : typeof session.startedAt === 'string'
            ? session.startedAt
            : fallbackTimestamp,
      channel:
        typeof session.channel === 'string' ? session.channel : undefined,
      requests: session.requests as ParsedRequest[],
      totalCost: typeof session.totalCost === 'number' ? session.totalCost : 0,
      totalInputTokens:
        typeof session.totalInputTokens === 'number'
          ? session.totalInputTokens
          : 0,
      totalOutputTokens:
        typeof session.totalOutputTokens === 'number'
          ? session.totalOutputTokens
          : 0,
      totalReasoningTokens:
        typeof session.totalReasoningTokens === 'number'
          ? session.totalReasoningTokens
          : 0,
      apiCallCount:
        typeof session.apiCallCount === 'number' ? session.apiCallCount : 0,
      costCurrency: 'CNY',
      costStatus:
        session.costStatus === 'reported' || session.costStatus === 'estimated'
          ? session.costStatus
          : 'unknown',
      costSource:
        typeof session.costSource === 'string' ? session.costSource : undefined,
      modelsUsed: session.modelsUsed.filter(
        (model): model is string => typeof model === 'string'
      ),
      toolCalls: session.toolCalls as ToolCallData[],
    },
  }
}
