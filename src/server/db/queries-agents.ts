// ============================================
// Agent & Channel interfaces (DB functions removed - use AnalyticsService)
// ============================================

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

export interface AgentStats {
  agents: Agent[];
  totalCost: number;
  totalSessions: number;
}

export interface ChannelStats {
  channels: Channel[];
  totalCost: number;
  totalMessages: number;
}
