export interface Session {
  id: string
  project_path: string
  started_at: string
  last_activity: string
  total_input_tokens: number
  total_output_tokens: number
  total_cost: number
  models_used: string[]
}

export interface Request {
  id?: number
  session_id: string
  timestamp: string
  provider: string
  model: string
  input_tokens: number
  output_tokens: number
  cache_creation_tokens: number
  cache_read_tokens: number
  cost: number
  message_type?: string
  raw_data?: string
}

export interface DailyCost {
  date: string
  total_cost: number
  total_input_tokens: number
  total_output_tokens: number
  cache_creation_tokens: number
  cache_read_tokens: number
  cache_savings: number
  session_count: number
  request_count: number
}

export interface ModelUsage {
  date: string
  provider: string
  model: string
  input_tokens: number
  output_tokens: number
  cost: number
  request_count: number
}

export interface Stats {
  todaySpend: number
  weeklySpend: number
  monthlySpend: number
  totalSessions: number
  todayTokens: { input: number; output: number }
}

export interface EnhancedStats {
  totalCost: number
  monthCost: number
  totalTokens: {
    input: number
    output: number
    cacheRead: number
    cacheCreation: number
  }
  cacheSavings: number
  activeSessionsThisMonth: number
}

export type AnalyticsStatus = 'scanning' | 'ready' | 'unavailable' | 'error'
export type AnalyticsSnapshotState = 'none' | 'cached' | 'verified' | 'stale'

export interface AnalyticsStatusResponse {
  status: AnalyticsStatus
  hasData: boolean
  snapshotState: AnalyticsSnapshotState
  timestamp: string
  lastScanStartedAt?: string
  lastScanCompletedAt?: string
  lastSuccessfulScanAt?: string
  lastScanError?: {
    code: 'INITIAL_SCAN_FAILED' | 'SCAN_FAILED'
    message: string
  }
}

export interface TokenBreakdown {
  input: number
  output: number
  cacheRead: number
  cacheCreation: number
}

export interface TokenPeriodSummary {
  total: number
  input: number
  output: number
  cacheRead: number
  cacheCreation: number
  cost: number
}

export interface TokenSummary {
  lifetime: TokenPeriodSummary
  last5Hours: TokenPeriodSummary
  last7Days: TokenPeriodSummary
  last30Days: TokenPeriodSummary
}

export interface PeriodSummary {
  totalCost: number
  inputTokens: number
  outputTokens: number
  cacheReadTokens: number
  cacheCreationTokens: number
  cacheSavings: number
  sessionCount: number
}

export interface CostSummary {
  lifetime: PeriodSummary
  thisMonth: PeriodSummary
  lastMonth: PeriodSummary
  today: PeriodSummary
}

export interface CacheSavingsDetail {
  totalSavings: number
  cacheReadTokens: number
  cacheCreationTokens: number
  savingsPercentage: number
}

export interface ModelUsageWithCache {
  provider: string
  model: string
  inputTokens: number
  outputTokens: number
  cacheReadTokens: number
  cacheCreationTokens: number
  cost: number
  requestCount: number
}

export interface ModelStats {
  totalModels: number
  totalProviders: number
  topModel: { provider: string; model: string; cost: number } | null
  topProvider: { provider: string; cost: number; modelCount: number } | null
}

export interface ModelDailyUsage {
  date: string
  provider: string
  model: string
  inputTokens: number
  outputTokens: number
  cost: number
  requestCount: number
}

export interface ProviderSummary {
  provider: string
  totalCost: number
  totalInputTokens: number
  totalOutputTokens: number
  modelCount: number
  requestCount: number
}

export interface WeeklyTrend {
  thisWeek: { cost: number; tokens: number; sessions: number }
  lastWeek: { cost: number; tokens: number; sessions: number }
  changePercent: number
}

export interface SessionStats {
  totalSessions: number
  totalSessionsThisMonth: number
  totalCost: number
  avgCostPerSession: number
  mostActiveProject: { project: string; sessionCount: number } | null
}

export interface ProjectBreakdown {
  project: string
  totalCost: number
  totalInputTokens: number
  totalOutputTokens: number
  sessionCount: number
}

export interface EnhancedSession extends Session {
  request_count: number
}

export interface EnhancedSessionsOptions {
  limit?: number
  offset?: number
  sortBy?: string
  sortDir?: 'asc' | 'desc'
  project?: string
  model?: string
  search?: string
}

export interface Agent {
  id: string
  name: string
  workspace: string | null
  created_at: string
  total_cost: number
  total_input_tokens: number
  total_output_tokens: number
  session_count: number
}

export interface AgentDailyCost {
  agent_id: string
  date: string
  total_cost: number
  input_tokens: number
  output_tokens: number
  cache_read_tokens: number
  cache_creation_tokens: number
  request_count: number
}

export interface Channel {
  id: number
  name: string
  total_cost: number
  total_input_tokens: number
  total_output_tokens: number
  message_count: number
}

export interface ChannelDailyCost {
  channel_id: number
  date: string
  total_cost: number
  input_tokens: number
  output_tokens: number
  message_count: number
}

export interface AgentStats {
  agents: Agent[]
  totalCost: number
  totalSessions: number
}

export interface ChannelStats {
  channels: Channel[]
  totalCost: number
  totalMessages: number
}
