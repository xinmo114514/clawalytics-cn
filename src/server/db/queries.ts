import { getDatabase } from './schema.js';

export interface Session {
  id: string;
  project_path: string;
  started_at: string;
  last_activity: string;
  total_input_tokens: number;
  total_output_tokens: number;
  total_cost: number;
  models_used: string[];
}

export interface Request {
  id?: number;
  session_id: string;
  timestamp: string;
  provider: string;
  model: string;
  input_tokens: number;
  output_tokens: number;
  cache_creation_tokens: number;
  cache_read_tokens: number;
  cost: number;
  message_type?: string;
  raw_data?: string;
}

export interface DailyCost {
  date: string;
  total_cost: number;
  total_input_tokens: number;
  total_output_tokens: number;
  cache_creation_tokens: number;
  cache_read_tokens: number;
  cache_savings: number;
  session_count: number;
  request_count: number;
}

export interface ModelUsage {
  date: string;
  provider: string;
  model: string;
  input_tokens: number;
  output_tokens: number;
  cost: number;
  request_count: number;
}

// Session queries
export function upsertSession(session: Omit<Session, 'models_used'> & { models_used: string[] }): void {
  const db = getDatabase();
  const stmt = db.prepare(`
    INSERT INTO sessions (id, project_path, started_at, last_activity, total_input_tokens, total_output_tokens, total_cost, models_used)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      last_activity = excluded.last_activity,
      total_input_tokens = excluded.total_input_tokens,
      total_output_tokens = excluded.total_output_tokens,
      total_cost = excluded.total_cost,
      models_used = excluded.models_used
  `);
  stmt.run(
    session.id,
    session.project_path,
    session.started_at,
    session.last_activity,
    session.total_input_tokens,
    session.total_output_tokens,
    session.total_cost,
    JSON.stringify(session.models_used)
  );
}

export function getSession(id: string): Session | undefined {
  const db = getDatabase();
  const row = db.prepare('SELECT * FROM sessions WHERE id = ?').get(id) as (Omit<Session, 'models_used'> & { models_used: string }) | undefined;
  if (row) {
    return { ...row, models_used: JSON.parse(row.models_used) };
  }
  return undefined;
}

export function getSessions(limit = 100, offset = 0): Session[] {
  const db = getDatabase();
  const rows = db.prepare(`
    SELECT * FROM sessions
    ORDER BY last_activity DESC
    LIMIT ? OFFSET ?
  `).all(limit, offset) as (Omit<Session, 'models_used'> & { models_used: string })[];

  return rows.map(row => ({
    ...row,
    models_used: JSON.parse(row.models_used)
  }));
}

export function getSessionCount(): number {
  const db = getDatabase();
  const row = db.prepare('SELECT COUNT(*) as count FROM sessions').get() as { count: number };
  return row.count;
}

// Request queries
export function insertRequest(request: Request): void {
  const db = getDatabase();
  const stmt = db.prepare(`
    INSERT INTO requests (session_id, timestamp, provider, model, input_tokens, output_tokens, cache_creation_tokens, cache_read_tokens, cost, message_type, raw_data)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  stmt.run(
    request.session_id,
    request.timestamp,
    request.provider,
    request.model,
    request.input_tokens,
    request.output_tokens,
    request.cache_creation_tokens || 0,
    request.cache_read_tokens || 0,
    request.cost,
    request.message_type || null,
    request.raw_data || null
  );
}

export function getRequests(sessionId: string): Request[] {
  const db = getDatabase();
  return db.prepare('SELECT * FROM requests WHERE session_id = ? ORDER BY timestamp DESC').all(sessionId) as Request[];
}

// Daily cost queries
export interface DailyCostUpdate {
  date: string;
  cost: number;
  inputTokens: number;
  outputTokens: number;
  cacheCreationTokens: number;
  cacheReadTokens: number;
  cacheSavings: number;
  isNewSession: boolean;
}

export function upsertDailyCost(update: DailyCostUpdate): void {
  const db = getDatabase();
  const stmt = db.prepare(`
    INSERT INTO daily_costs (date, total_cost, total_input_tokens, total_output_tokens, cache_creation_tokens, cache_read_tokens, cache_savings, session_count, request_count)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)
    ON CONFLICT(date) DO UPDATE SET
      total_cost = daily_costs.total_cost + excluded.total_cost,
      total_input_tokens = daily_costs.total_input_tokens + excluded.total_input_tokens,
      total_output_tokens = daily_costs.total_output_tokens + excluded.total_output_tokens,
      cache_creation_tokens = daily_costs.cache_creation_tokens + excluded.cache_creation_tokens,
      cache_read_tokens = daily_costs.cache_read_tokens + excluded.cache_read_tokens,
      cache_savings = daily_costs.cache_savings + excluded.cache_savings,
      session_count = daily_costs.session_count + ?,
      request_count = daily_costs.request_count + 1
  `);
  stmt.run(
    update.date,
    update.cost,
    update.inputTokens,
    update.outputTokens,
    update.cacheCreationTokens,
    update.cacheReadTokens,
    update.cacheSavings,
    update.isNewSession ? 1 : 0
  );
}

export function getDailyCosts(days = 30): DailyCost[] {
  const db = getDatabase();
  return db.prepare(`
    SELECT * FROM daily_costs
    WHERE date >= date('now', '-' || ? || ' days')
    ORDER BY date ASC
  `).all(days) as DailyCost[];
}

export function getTodayCost(): number {
  const db = getDatabase();
  const row = db.prepare(`
    SELECT COALESCE(SUM(total_cost), 0) as cost FROM daily_costs
    WHERE date = date('now')
  `).get() as { cost: number };
  return row.cost;
}

export function getWeekCost(): number {
  const db = getDatabase();
  const row = db.prepare(`
    SELECT COALESCE(SUM(total_cost), 0) as cost FROM daily_costs
    WHERE date >= date('now', '-7 days')
  `).get() as { cost: number };
  return row.cost;
}

export function getMonthCost(): number {
  const db = getDatabase();
  const row = db.prepare(`
    SELECT COALESCE(SUM(total_cost), 0) as cost FROM daily_costs
    WHERE date >= date('now', '-30 days')
  `).get() as { cost: number };
  return row.cost;
}

// Model usage queries
export function upsertModelUsage(date: string, provider: string, model: string, inputTokens: number, outputTokens: number, cost: number): void {
  const db = getDatabase();
  const stmt = db.prepare(`
    INSERT INTO model_usage (date, provider, model, input_tokens, output_tokens, cost, request_count)
    VALUES (?, ?, ?, ?, ?, ?, 1)
    ON CONFLICT(date, provider, model) DO UPDATE SET
      input_tokens = model_usage.input_tokens + excluded.input_tokens,
      output_tokens = model_usage.output_tokens + excluded.output_tokens,
      cost = model_usage.cost + excluded.cost,
      request_count = model_usage.request_count + 1
  `);
  stmt.run(date, provider, model, inputTokens, outputTokens, cost);
}

export function getModelUsage(days = 30): ModelUsage[] {
  const db = getDatabase();
  return db.prepare(`
    SELECT
      provider,
      model,
      SUM(input_tokens) as input_tokens,
      SUM(output_tokens) as output_tokens,
      SUM(cost) as cost,
      SUM(request_count) as request_count
    FROM model_usage
    WHERE date >= date('now', '-' || ? || ' days')
    GROUP BY provider, model
    ORDER BY cost DESC
  `).all(days) as ModelUsage[];
}

// Stats queries
export interface Stats {
  todaySpend: number;
  weeklySpend: number;
  monthlySpend: number;
  totalSessions: number;
  todayTokens: { input: number; output: number };
}

export function getStats(): Stats {
  const db = getDatabase();

  const todayRow = db.prepare(`
    SELECT
      COALESCE(SUM(total_cost), 0) as cost,
      COALESCE(SUM(total_input_tokens), 0) as input_tokens,
      COALESCE(SUM(total_output_tokens), 0) as output_tokens
    FROM daily_costs WHERE date = date('now')
  `).get() as { cost: number; input_tokens: number; output_tokens: number };

  const weekRow = db.prepare(`
    SELECT COALESCE(SUM(total_cost), 0) as cost
    FROM daily_costs WHERE date >= date('now', '-7 days')
  `).get() as { cost: number };

  const monthRow = db.prepare(`
    SELECT COALESCE(SUM(total_cost), 0) as cost
    FROM daily_costs WHERE date >= date('now', '-30 days')
  `).get() as { cost: number };

  const sessionRow = db.prepare('SELECT COUNT(*) as count FROM sessions').get() as { count: number };

  return {
    todaySpend: todayRow.cost,
    weeklySpend: weekRow.cost,
    monthlySpend: monthRow.cost,
    totalSessions: sessionRow.count,
    todayTokens: {
      input: todayRow.input_tokens,
      output: todayRow.output_tokens,
    },
  };
}

// Enhanced stats for dashboard
export interface EnhancedStats {
  totalCost: number;
  monthCost: number;
  totalTokens: {
    input: number;
    output: number;
    cacheRead: number;
    cacheCreation: number;
  };
  cacheSavings: number;
  activeSessionsThisMonth: number;
}

export function getEnhancedStats(): EnhancedStats {
  const db = getDatabase();

  // Total lifetime cost and tokens
  const totalRow = db.prepare(`
    SELECT
      COALESCE(SUM(total_cost), 0) as cost,
      COALESCE(SUM(total_input_tokens), 0) as input_tokens,
      COALESCE(SUM(total_output_tokens), 0) as output_tokens,
      COALESCE(SUM(cache_read_tokens), 0) as cache_read,
      COALESCE(SUM(cache_creation_tokens), 0) as cache_creation,
      COALESCE(SUM(cache_savings), 0) as cache_savings
    FROM daily_costs
  `).get() as {
    cost: number;
    input_tokens: number;
    output_tokens: number;
    cache_read: number;
    cache_creation: number;
    cache_savings: number;
  };

  // This month cost
  const monthRow = db.prepare(`
    SELECT COALESCE(SUM(total_cost), 0) as cost
    FROM daily_costs
    WHERE date >= date('now', 'start of month')
  `).get() as { cost: number };

  // Active sessions this month
  const sessionRow = db.prepare(`
    SELECT COUNT(*) as count
    FROM sessions
    WHERE last_activity >= date('now', 'start of month')
  `).get() as { count: number };

  return {
    totalCost: totalRow.cost,
    monthCost: monthRow.cost,
    totalTokens: {
      input: totalRow.input_tokens,
      output: totalRow.output_tokens,
      cacheRead: totalRow.cache_read,
      cacheCreation: totalRow.cache_creation,
    },
    cacheSavings: totalRow.cache_savings,
    activeSessionsThisMonth: sessionRow.count,
  };
}

// Token breakdown for visualization
export interface TokenBreakdown {
  input: number;
  output: number;
  cacheRead: number;
  cacheCreation: number;
}

export function getTokenBreakdown(days?: number): TokenBreakdown & { total: number } {
  const db = getDatabase();

  const whereClause = days !== undefined ? `WHERE date >= date('now', '-${days} days')` : '';

  const row = db.prepare(`
    SELECT
      COALESCE(SUM(total_input_tokens), 0) as input,
      COALESCE(SUM(total_output_tokens), 0) as output,
      COALESCE(SUM(cache_read_tokens), 0) as cache_read,
      COALESCE(SUM(cache_creation_tokens), 0) as cache_creation
    FROM daily_costs
    ${whereClause}
  `).get() as {
    input: number;
    output: number;
    cache_read: number;
    cache_creation: number;
  };

  return {
    input: row.input,
    output: row.output,
    cacheRead: row.cache_read,
    cacheCreation: row.cache_creation,
    total: row.input + row.output + row.cache_read + row.cache_creation,
  };
}

// ============================================
// Comprehensive Cost Summary
// ============================================

export interface PeriodSummary {
  totalCost: number;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheCreationTokens: number;
  cacheSavings: number;
  sessionCount: number;
}

export interface CostSummary {
  lifetime: PeriodSummary;
  thisMonth: PeriodSummary;
  lastMonth: PeriodSummary;
  today: PeriodSummary;
}

interface PeriodSummaryRow {
  total_cost: number;
  input_tokens: number;
  output_tokens: number;
  cache_read_tokens: number;
  cache_creation_tokens: number;
  cache_savings: number;
  session_count: number;
}

function buildPeriodSummary(row: PeriodSummaryRow): PeriodSummary {
  return {
    totalCost: row.total_cost,
    inputTokens: row.input_tokens,
    outputTokens: row.output_tokens,
    cacheReadTokens: row.cache_read_tokens,
    cacheCreationTokens: row.cache_creation_tokens,
    cacheSavings: row.cache_savings,
    sessionCount: row.session_count,
  };
}

export function getCostSummary(): CostSummary {
  const db = getDatabase();

  // Lifetime totals
  const lifetimeRow = db.prepare(`
    SELECT
      COALESCE(SUM(total_cost), 0) as total_cost,
      COALESCE(SUM(total_input_tokens), 0) as input_tokens,
      COALESCE(SUM(total_output_tokens), 0) as output_tokens,
      COALESCE(SUM(cache_read_tokens), 0) as cache_read_tokens,
      COALESCE(SUM(cache_creation_tokens), 0) as cache_creation_tokens,
      COALESCE(SUM(cache_savings), 0) as cache_savings,
      COALESCE(SUM(session_count), 0) as session_count
    FROM daily_costs
  `).get() as PeriodSummaryRow;

  // This month (current calendar month)
  const thisMonthRow = db.prepare(`
    SELECT
      COALESCE(SUM(total_cost), 0) as total_cost,
      COALESCE(SUM(total_input_tokens), 0) as input_tokens,
      COALESCE(SUM(total_output_tokens), 0) as output_tokens,
      COALESCE(SUM(cache_read_tokens), 0) as cache_read_tokens,
      COALESCE(SUM(cache_creation_tokens), 0) as cache_creation_tokens,
      COALESCE(SUM(cache_savings), 0) as cache_savings,
      COALESCE(SUM(session_count), 0) as session_count
    FROM daily_costs
    WHERE strftime('%Y-%m', date) = strftime('%Y-%m', 'now')
  `).get() as PeriodSummaryRow;

  // Last month (previous calendar month)
  const lastMonthRow = db.prepare(`
    SELECT
      COALESCE(SUM(total_cost), 0) as total_cost,
      COALESCE(SUM(total_input_tokens), 0) as input_tokens,
      COALESCE(SUM(total_output_tokens), 0) as output_tokens,
      COALESCE(SUM(cache_read_tokens), 0) as cache_read_tokens,
      COALESCE(SUM(cache_creation_tokens), 0) as cache_creation_tokens,
      COALESCE(SUM(cache_savings), 0) as cache_savings,
      COALESCE(SUM(session_count), 0) as session_count
    FROM daily_costs
    WHERE strftime('%Y-%m', date) = strftime('%Y-%m', date('now', '-1 month'))
  `).get() as PeriodSummaryRow;

  // Today
  const todayRow = db.prepare(`
    SELECT
      COALESCE(SUM(total_cost), 0) as total_cost,
      COALESCE(SUM(total_input_tokens), 0) as input_tokens,
      COALESCE(SUM(total_output_tokens), 0) as output_tokens,
      COALESCE(SUM(cache_read_tokens), 0) as cache_read_tokens,
      COALESCE(SUM(cache_creation_tokens), 0) as cache_creation_tokens,
      COALESCE(SUM(cache_savings), 0) as cache_savings,
      COALESCE(SUM(session_count), 0) as session_count
    FROM daily_costs
    WHERE date = date('now')
  `).get() as PeriodSummaryRow;

  return {
    lifetime: buildPeriodSummary(lifetimeRow),
    thisMonth: buildPeriodSummary(thisMonthRow),
    lastMonth: buildPeriodSummary(lastMonthRow),
    today: buildPeriodSummary(todayRow),
  };
}

// ============================================
// Cache Savings Analysis
// ============================================

export interface CacheSavingsDetail {
  totalSavings: number;
  cacheReadTokens: number;
  cacheCreationTokens: number;
  savingsPercentage: number;
}

export function getCacheSavings(days?: number): CacheSavingsDetail {
  const db = getDatabase();

  const whereClause = days !== undefined ? `WHERE date >= date('now', '-${days} days')` : '';

  const row = db.prepare(`
    SELECT
      COALESCE(SUM(cache_savings), 0) as savings,
      COALESCE(SUM(cache_read_tokens), 0) as cache_read,
      COALESCE(SUM(cache_creation_tokens), 0) as cache_creation,
      COALESCE(SUM(total_cost), 0) as total_cost
    FROM daily_costs
    ${whereClause}
  `).get() as { savings: number; cache_read: number; cache_creation: number; total_cost: number };

  // Calculate savings percentage: savings / (total_cost + savings) * 100
  // This represents what percentage of potential cost was saved
  const potentialCost = row.total_cost + row.savings;
  const savingsPercentage = potentialCost > 0 ? (row.savings / potentialCost) * 100 : 0;

  return {
    totalSavings: row.savings,
    cacheReadTokens: row.cache_read,
    cacheCreationTokens: row.cache_creation,
    savingsPercentage: Math.round(savingsPercentage * 100) / 100, // Round to 2 decimal places
  };
}

// ============================================
// Model Usage with Cache Breakdown
// ============================================

export interface ModelUsageWithCache {
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheCreationTokens: number;
  cost: number;
  requestCount: number;
}

export function getModelUsageWithCache(days = 30): ModelUsageWithCache[] {
  const db = getDatabase();

  // Query from requests table for accurate cache data per model
  const rows = db.prepare(`
    SELECT
      provider,
      model,
      SUM(input_tokens) as input_tokens,
      SUM(output_tokens) as output_tokens,
      COALESCE(SUM(cache_read_tokens), 0) as cache_read_tokens,
      COALESCE(SUM(cache_creation_tokens), 0) as cache_creation_tokens,
      SUM(cost) as cost,
      COUNT(*) as request_count
    FROM requests
    WHERE date(timestamp) >= date('now', '-' || ? || ' days')
    GROUP BY provider, model
    ORDER BY cost DESC
  `).all(days) as Array<{
    provider: string;
    model: string;
    input_tokens: number;
    output_tokens: number;
    cache_read_tokens: number;
    cache_creation_tokens: number;
    cost: number;
    request_count: number;
  }>;

  return rows.map(row => ({
    provider: row.provider,
    model: row.model,
    inputTokens: row.input_tokens,
    outputTokens: row.output_tokens,
    cacheReadTokens: row.cache_read_tokens,
    cacheCreationTokens: row.cache_creation_tokens,
    cost: row.cost,
    requestCount: row.request_count,
  }));
}

// ============================================
// Weekly Trend Analysis
// ============================================

export interface WeeklyTrend {
  thisWeek: { cost: number; tokens: number; sessions: number };
  lastWeek: { cost: number; tokens: number; sessions: number };
  changePercent: number;
}

export function getWeeklyTrend(): WeeklyTrend {
  const db = getDatabase();

  // This week (last 7 days including today)
  const thisWeekRow = db.prepare(`
    SELECT
      COALESCE(SUM(total_cost), 0) as cost,
      COALESCE(SUM(total_input_tokens + total_output_tokens), 0) as tokens,
      COALESCE(SUM(session_count), 0) as sessions
    FROM daily_costs
    WHERE date >= date('now', '-6 days')
  `).get() as { cost: number; tokens: number; sessions: number };

  // Last week (7-13 days ago)
  const lastWeekRow = db.prepare(`
    SELECT
      COALESCE(SUM(total_cost), 0) as cost,
      COALESCE(SUM(total_input_tokens + total_output_tokens), 0) as tokens,
      COALESCE(SUM(session_count), 0) as sessions
    FROM daily_costs
    WHERE date >= date('now', '-13 days') AND date < date('now', '-6 days')
  `).get() as { cost: number; tokens: number; sessions: number };

  // Calculate percentage change in cost
  const changePercent = lastWeekRow.cost > 0
    ? Math.round(((thisWeekRow.cost - lastWeekRow.cost) / lastWeekRow.cost) * 10000) / 100
    : thisWeekRow.cost > 0 ? 100 : 0;

  return {
    thisWeek: {
      cost: thisWeekRow.cost,
      tokens: thisWeekRow.tokens,
      sessions: thisWeekRow.sessions,
    },
    lastWeek: {
      cost: lastWeekRow.cost,
      tokens: lastWeekRow.tokens,
      sessions: lastWeekRow.sessions,
    },
    changePercent,
  };
}
