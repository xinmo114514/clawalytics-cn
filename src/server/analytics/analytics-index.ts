import type {
  DailyCost,
  ModelUsage,
  ModelUsageWithCache,
  TokenBreakdown,
} from '../../shared/analytics-contracts.js'
import type { AggregatedStats, SessionData } from './domain.js'

export interface DailyTokenTotals extends TokenBreakdown {
  total: number
}

export interface AnalyticsIndex {
  date: string
  dailyCosts: Map<string, DailyCost>
  modelUsageByDate: Map<string, Map<string, ModelUsage>>
  modelUsageWithCacheByDate: Map<string, Map<string, ModelUsageWithCache>>
  tokenTotalsByDate: Map<string, DailyTokenTotals>
  stats: AggregatedStats
}

export function formatLocalDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate()
  ).padStart(2, '0')}`
}

export function localDateFromIso(iso: string): string {
  const date = new Date(iso)
  return Number.isNaN(date.getTime())
    ? iso.split('T')[0]
    : formatLocalDate(date)
}

export function localWindowStart(now: Date, days: number): string {
  const normalized = Number.isFinite(days) ? Math.max(1, Math.floor(days)) : 1
  const start = new Date(now)
  start.setDate(start.getDate() - (normalized - 1))
  return formatLocalDate(start)
}

export function localWeekStart(now: Date): string {
  const start = new Date(now)
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7))
  return formatLocalDate(start)
}

export function buildAnalyticsIndex(
  sessions: ReadonlyMap<string, SessionData>,
  now: Date
): AnalyticsIndex {
  const today = formatLocalDate(now)
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
  const weekStart = localWeekStart(now)
  const dailyCosts = new Map<string, DailyCost>()
  const dailySessions = new Map<string, Set<string>>()
  const modelUsageByDate = new Map<string, Map<string, ModelUsage>>()
  const modelUsageWithCacheByDate = new Map<
    string,
    Map<string, ModelUsageWithCache>
  >()
  const tokenTotalsByDate = new Map<string, DailyTokenTotals>()
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

  for (const session of sessions.values()) {
    const lastActivityDate = localDateFromIso(session.lastActivity)
    if (lastActivityDate >= monthStart && lastActivityDate <= today) {
      stats.activeThisMonth++
    }

    for (const request of session.requests) {
      const date = localDateFromIso(request.timestamp)
      const modelKey = `${request.provider}/${request.model}`
      const requestCount = Math.max(0, request.apiCallCount ?? 1)

      let day = dailyCosts.get(date)
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
        dailyCosts.set(date, day)
        dailySessions.set(date, new Set())
      }
      day.total_cost += request.cost
      day.total_input_tokens += request.inputTokens
      day.total_output_tokens += request.outputTokens
      day.cache_creation_tokens += request.cacheCreationTokens
      day.cache_read_tokens += request.cacheReadTokens
      day.cache_savings += request.cacheSavings
      day.request_count += requestCount
      if (request.usageGranularity === 'aggregate') {
        day.contains_aggregate_data = true
      }
      dailySessions.get(date)!.add(session.id)

      let perModel = modelUsageByDate.get(date)
      if (!perModel) {
        perModel = new Map()
        modelUsageByDate.set(date, perModel)
      }
      let model = perModel.get(modelKey)
      if (!model) {
        model = {
          date,
          provider: request.provider,
          model: request.model,
          input_tokens: 0,
          output_tokens: 0,
          cost: 0,
          request_count: 0,
        }
        perModel.set(modelKey, model)
      }
      model.input_tokens += request.inputTokens
      model.output_tokens += request.outputTokens
      model.cost += request.cost
      model.request_count += requestCount

      let perModelWithCache = modelUsageWithCacheByDate.get(date)
      if (!perModelWithCache) {
        perModelWithCache = new Map()
        modelUsageWithCacheByDate.set(date, perModelWithCache)
      }
      let modelWithCache = perModelWithCache.get(modelKey)
      if (!modelWithCache) {
        modelWithCache = {
          provider: request.provider,
          model: request.model,
          inputTokens: 0,
          outputTokens: 0,
          cacheReadTokens: 0,
          cacheCreationTokens: 0,
          cost: 0,
          requestCount: 0,
        }
        perModelWithCache.set(modelKey, modelWithCache)
      }
      modelWithCache.inputTokens += request.inputTokens
      modelWithCache.outputTokens += request.outputTokens
      modelWithCache.cacheReadTokens += request.cacheReadTokens
      modelWithCache.cacheCreationTokens += request.cacheCreationTokens
      modelWithCache.cost += request.cost
      modelWithCache.requestCount += requestCount

      let tokens = tokenTotalsByDate.get(date)
      if (!tokens) {
        tokens = {
          input: 0,
          output: 0,
          cacheRead: 0,
          cacheCreation: 0,
          total: 0,
        }
        tokenTotalsByDate.set(date, tokens)
      }
      tokens.input += request.inputTokens
      tokens.output += request.outputTokens
      tokens.cacheRead += request.cacheReadTokens
      tokens.cacheCreation += request.cacheCreationTokens
      tokens.total +=
        request.inputTokens +
        request.outputTokens +
        request.cacheReadTokens +
        request.cacheCreationTokens

      if (date > today) continue
      stats.totalCost += request.cost
      stats.totalInput += request.inputTokens
      stats.totalOutput += request.outputTokens
      stats.totalCacheRead += request.cacheReadTokens
      stats.totalCacheCreation += request.cacheCreationTokens
      stats.totalCacheSavings += request.cacheSavings
      if (date === today) {
        stats.todaySpend += request.cost
        stats.todayInput += request.inputTokens
        stats.todayOutput += request.outputTokens
      }
      if (date >= weekStart) stats.weekSpend += request.cost
      if (date >= monthStart) stats.monthSpend += request.cost
    }
  }

  for (const [date, day] of dailyCosts) {
    day.session_count = dailySessions.get(date)?.size ?? 0
  }

  return {
    date: today,
    dailyCosts,
    modelUsageByDate,
    modelUsageWithCacheByDate,
    tokenTotalsByDate,
    stats,
  }
}
