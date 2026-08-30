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
