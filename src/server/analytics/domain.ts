import type {
  AnalyticsCostStatus,
  AnalyticsSourceType,
  UsageGranularity,
} from '../../shared/analytics-contracts.js'

export interface ParsedRequest {
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
  sourceType?: AnalyticsSourceType
  reasoningTokens?: number
  apiCallCount?: number
  usageGranularity?: UsageGranularity
  costCurrency?: 'CNY'
  costStatus?: AnalyticsCostStatus
  costSource?: string
}

export interface ToolCallData {
  sessionId: string
  agentId: string
  toolName: string
  toolUseId: string
  timestamp: string
  durationMs: number | null
  status: string | null
  error: string | null
}

export interface SessionData {
  id: string
  rawSessionId?: string
  sourceType?: AnalyticsSourceType
  usageGranularity?: UsageGranularity
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
  costStatus?: AnalyticsCostStatus
  costSource?: string
  modelsUsed: Set<string>
  toolCalls: ToolCallData[]
}

export interface AggregatedStats {
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
