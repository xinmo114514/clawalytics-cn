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

// Phase 2: Agent types
export interface Agent {
  id: string;
  name: string;
  workspace: string | null;
  created_at: string;
  total_cost: number;
  total_input_tokens: number;
  total_output_tokens: number;
  session_count: number;
}

export interface AgentDailyCost {
  agent_id: string;
  date: string;
  total_cost: number;
  input_tokens: number;
  output_tokens: number;
  cache_read_tokens: number;
  cache_creation_tokens: number;
  request_count: number;
}

export interface AgentStats {
  agents: Agent[];
  totalCost: number;
  totalSessions: number;
}

// Phase 2: Channel types
export interface Channel {
  id: number;
  name: string;
  total_cost: number;
  total_input_tokens: number;
  total_output_tokens: number;
  message_count: number;
}

export interface ChannelDailyCost {
  channel_id: number;
  date: string;
  total_cost: number;
  input_tokens: number;
  output_tokens: number;
  message_count: number;
}

export interface ChannelStats {
  channels: Channel[];
  totalCost: number;
  totalMessages: number;
}

// Phase 2: Agent API functions
export async function getAgents(): Promise<Agent[]> {
  const { data } = await api.get<Agent[]>('/agents');
  return data;
}

export async function getAgent(id: string): Promise<Agent> {
  const { data } = await api.get<Agent>(`/agents/${id}`);
  return data;
}

export async function getAgentStats(limit = 10): Promise<AgentStats> {
  const { data } = await api.get<AgentStats>('/agents/stats', {
    params: { limit },
  });
  return data;
}

export async function getAgentDailyCosts(
  agentId: string,
  days = 30
): Promise<AgentDailyCost[]> {
  const { data } = await api.get<AgentDailyCost[]>(
    `/agents/${agentId}/costs/daily`,
    {
      params: { days },
    }
  );
  return data;
}

export async function getAllAgentsDailyCosts(
  days = 30
): Promise<AgentDailyCost[]> {
  const { data } = await api.get<AgentDailyCost[]>('/agents/costs/daily', {
    params: { days },
  });
  return data;
}

// Phase 2: Channel API functions
export async function getChannels(): Promise<Channel[]> {
  const { data } = await api.get<Channel[]>('/channels');
  return data;
}

export async function getChannel(id: number): Promise<Channel> {
  const { data } = await api.get<Channel>(`/channels/${id}`);
  return data;
}

export async function getChannelStats(limit = 10): Promise<ChannelStats> {
  const { data } = await api.get<ChannelStats>('/channels/stats', {
    params: { limit },
  });
  return data;
}

export async function getChannelDailyCosts(
  channelId: number,
  days = 30
): Promise<ChannelDailyCost[]> {
  const { data } = await api.get<ChannelDailyCost[]>(
    `/channels/${channelId}/costs/daily`,
    {
      params: { days },
    }
  );
  return data;
}

export async function getAllChannelsDailyCosts(
  days = 30
): Promise<ChannelDailyCost[]> {
  const { data } = await api.get<ChannelDailyCost[]>('/channels/costs/daily', {
    params: { days },
  });
  return data;
}

// Phase 3: Device types
export interface Device {
  id: string;
  name: string | null;
  type: string | null;
  paired_at: string;
  last_seen: string | null;
  status: string;
  connection_count: number;
}

export interface PairingRequest {
  id: number;
  device_id: string;
  device_name: string | null;
  requested_at: string;
  responded_at: string | null;
  status: string;
  response: string | null;
}

// Phase 3: Security types
export interface SecurityAlert {
  id: number;
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  timestamp: string;
  acknowledged: boolean;
  acknowledged_at: string | null;
  details: string | null;
}

export interface ConnectionEvent {
  id: number;
  device_id: string | null;
  event_type: string;
  timestamp: string;
  ip_address: string | null;
  details: string | null;
}

export interface OutboundCall {
  id: number;
  session_id: string | null;
  agent_id: string | null;
  tool_name: string;
  timestamp: string;
  duration_ms: number | null;
  status: string | null;
  error: string | null;
}

export interface AuditEntry {
  id: number;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  timestamp: string;
  actor: string | null;
  details: string | null;
  ip_address: string | null;
}

export interface SecurityDashboardStats {
  activeDevices: number;
  pendingRequests: number;
  unacknowledgedAlerts: number;
  recentConnections: number;
  alertsByLevel: { low: number; medium: number; high: number; critical: number };
}

export interface AuditFilters {
  action?: string;
  entityType?: string;
  startDate?: string;
  endDate?: string;
  limit?: number;
  offset?: number;
}

export interface ToolStats {
  toolName: string;
  count: number;
  avgDuration: number;
}

// Phase 3: Device API functions
export async function getDevices(): Promise<Device[]> {
  const { data } = await api.get<Device[]>('/devices');
  return data;
}

export async function getActiveDevices(): Promise<Device[]> {
  const { data } = await api.get<Device[]>('/devices/active');
  return data;
}

export async function getPendingRequests(): Promise<PairingRequest[]> {
  const { data } = await api.get<PairingRequest[]>('/devices/pairing/pending');
  return data;
}

export async function respondToPairingRequest(
  id: number,
  status: string,
  response?: string
): Promise<void> {
  await api.post(`/devices/pairing/${id}/respond`, { status, response });
}

// Phase 3: Security API functions
export async function getSecurityDashboard(): Promise<SecurityDashboardStats> {
  const { data } = await api.get<SecurityDashboardStats>('/security/dashboard');
  return data;
}

export async function getAlerts(
  acknowledged?: boolean,
  limit?: number
): Promise<SecurityAlert[]> {
  const params: Record<string, unknown> = {};
  if (acknowledged !== undefined) params.acknowledged = acknowledged;
  if (limit !== undefined) params.limit = limit;
  const { data } = await api.get<SecurityAlert[]>('/security/alerts', { params });
  return data;
}

export async function getUnacknowledgedAlerts(): Promise<SecurityAlert[]> {
  const { data } = await api.get<SecurityAlert[]>('/security/alerts/unacknowledged');
  return data;
}

export async function acknowledgeAlert(id: number): Promise<void> {
  await api.post(`/security/alerts/${id}/acknowledge`);
}

export async function acknowledgeAllAlerts(): Promise<{ count: number }> {
  const { data } = await api.post<{ count: number }>('/security/alerts/acknowledge-all');
  return data;
}

// Phase 3: Connection API functions
export async function getConnectionEvents(
  limit?: number,
  deviceId?: string
): Promise<ConnectionEvent[]> {
  const params: Record<string, unknown> = {};
  if (limit !== undefined) params.limit = limit;
  if (deviceId !== undefined) params.deviceId = deviceId;
  const { data } = await api.get<ConnectionEvent[]>('/security/connections', { params });
  return data;
}

export async function getRecentConnections(hours?: number): Promise<ConnectionEvent[]> {
  const params: Record<string, unknown> = {};
  if (hours !== undefined) params.hours = hours;
  const { data } = await api.get<ConnectionEvent[]>('/security/connections/recent', {
    params,
  });
  return data;
}

// Phase 3: Tool API functions
export async function getOutboundCalls(
  limit?: number,
  agentId?: string
): Promise<OutboundCall[]> {
  const params: Record<string, unknown> = {};
  if (limit !== undefined) params.limit = limit;
  if (agentId !== undefined) params.agentId = agentId;
  const { data } = await api.get<OutboundCall[]>('/tools', { params });
  return data;
}

interface BackendToolStats {
  totalCalls: number;
  uniqueTools: number;
  avgDurationMs: number | null;
  errorRate: number;
  topTools: Array<{
    tool_name: string;
    call_count: number;
    avg_duration_ms: number | null;
    error_count: number;
  }>;
}

export async function getToolStats(days?: number): Promise<ToolStats[]> {
  const params: Record<string, unknown> = {};
  if (days !== undefined) params.days = days;
  const { data } = await api.get<BackendToolStats>('/tools/stats', { params });
  // Transform backend format to frontend format
  return (data.topTools ?? []).map((tool) => ({
    toolName: tool.tool_name,
    count: tool.call_count,
    avgDuration: tool.avg_duration_ms ?? 0,
  }));
}

// Phase 3: Audit API functions
export async function getAuditLog(filters?: AuditFilters): Promise<AuditEntry[]> {
  const { data } = await api.get<AuditEntry[]>('/audit', { params: filters });
  return data;
}

export async function getRecentAuditLog(hours?: number): Promise<AuditEntry[]> {
  const params: Record<string, unknown> = {};
  if (hours !== undefined) params.hours = hours;
  const { data } = await api.get<AuditEntry[]>('/audit/recent', { params });
  return data;
}

export default api;
