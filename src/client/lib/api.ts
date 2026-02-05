import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
});

// Types
export interface Stats {
  todaySpend: number;
  weeklySpend: number;
  monthlySpend: number;
  totalSessions: number;
  todayTokens: {
    input: number;
    output: number;
  };
}

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

export interface TokenBreakdown {
  input: number;
  output: number;
  cacheRead: number;
  cacheCreation: number;
}

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

export interface SessionsResponse {
  sessions: Session[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
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
  provider: string;
  model: string;
  input_tokens: number;
  output_tokens: number;
  cost: number;
  request_count: number;
}

export interface Config {
  logPath: string;
  rates: Record<string, Record<string, { input: number; output: number }>>;
  alertThresholds: {
    dailyBudget: number;
    weeklyBudget: number;
    monthlyBudget: number;
  };
  configPath?: string;
}

// API functions
export async function getStats(): Promise<Stats> {
  const { data } = await api.get<Stats>('/stats');
  return data;
}

export async function getEnhancedStats(): Promise<EnhancedStats> {
  const { data } = await api.get<EnhancedStats>('/stats/enhanced');
  return data;
}

export async function getTokenBreakdown(days = 30): Promise<TokenBreakdown> {
  const { data } = await api.get<TokenBreakdown>('/stats/tokens', {
    params: { days },
  });
  return data;
}

export async function getSessions(limit = 100, offset = 0): Promise<SessionsResponse> {
  const { data } = await api.get<SessionsResponse>('/sessions', {
    params: { limit, offset },
  });
  return data;
}

export async function getSession(id: string): Promise<Session> {
  const { data } = await api.get<Session>(`/sessions/${id}`);
  return data;
}

export async function getDailyCosts(days = 30): Promise<DailyCost[]> {
  const { data } = await api.get<DailyCost[]>('/costs/daily', {
    params: { days },
  });
  return data;
}

export async function getModelUsage(days = 30): Promise<ModelUsage[]> {
  const { data } = await api.get<ModelUsage[]>('/costs/by-model', {
    params: { days },
  });
  return data;
}

export async function getConfig(): Promise<Config> {
  const { data } = await api.get<Config>('/config');
  return data;
}

export async function updateConfig(config: Partial<Config>): Promise<Config> {
  const { data } = await api.post<Config>('/config', config);
  return data;
}

export async function updateProviderRate(
  provider: string,
  model: string,
  rates: { input: number; output: number }
): Promise<{ input: number; output: number }> {
  const { data } = await api.post(`/config/rates/${provider}/${model}`, rates);
  return data;
}

export default api;
