import { getDatabase } from './schema.js';

// ============================================
// Agent Interfaces
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

export interface AgentInput {
  id: string;
  name: string;
  workspace?: string | null;
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

// ============================================
// Channel Interfaces
// ============================================

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

// ============================================
// Agent Queries
// ============================================

export function upsertAgent(agent: AgentInput): void {
  const db = getDatabase();
  const stmt = db.prepare(`
    INSERT INTO agents (id, name, workspace)
    VALUES (?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name,
      workspace = COALESCE(excluded.workspace, agents.workspace)
  `);
  stmt.run(agent.id, agent.name, agent.workspace ?? null);
}

export function getAgents(): Agent[] {
  const db = getDatabase();
  return db.prepare(`
    SELECT * FROM agents
    ORDER BY total_cost DESC
  `).all() as Agent[];
}

export function getAgent(id: string): Agent | undefined {
  const db = getDatabase();
  return db.prepare('SELECT * FROM agents WHERE id = ?').get(id) as Agent | undefined;
}

export function updateAgentStats(
  agentId: string,
  cost: number,
  inputTokens: number,
  outputTokens: number
): void {
  const db = getDatabase();
  const stmt = db.prepare(`
    UPDATE agents SET
      total_cost = total_cost + ?,
      total_input_tokens = total_input_tokens + ?,
      total_output_tokens = total_output_tokens + ?
    WHERE id = ?
  `);
  stmt.run(cost, inputTokens, outputTokens, agentId);
}

export function incrementAgentSessionCount(agentId: string): void {
  const db = getDatabase();
  const stmt = db.prepare(`
    UPDATE agents SET session_count = session_count + 1
    WHERE id = ?
  `);
  stmt.run(agentId);
}

export function getAgentDailyCosts(agentId: string, days = 30): AgentDailyCost[] {
  const db = getDatabase();
  return db.prepare(`
    SELECT * FROM agent_daily_costs
    WHERE agent_id = ? AND date >= date('now', '-' || ? || ' days')
    ORDER BY date ASC
  `).all(agentId, days) as AgentDailyCost[];
}

export function upsertAgentDailyCost(
  agentId: string,
  date: string,
  cost: number,
  inputTokens: number,
  outputTokens: number,
  cacheReadTokens: number,
  cacheCreationTokens: number
): void {
  const db = getDatabase();
  const stmt = db.prepare(`
    INSERT INTO agent_daily_costs (agent_id, date, total_cost, input_tokens, output_tokens, cache_read_tokens, cache_creation_tokens, request_count)
    VALUES (?, ?, ?, ?, ?, ?, ?, 1)
    ON CONFLICT(agent_id, date) DO UPDATE SET
      total_cost = agent_daily_costs.total_cost + excluded.total_cost,
      input_tokens = agent_daily_costs.input_tokens + excluded.input_tokens,
      output_tokens = agent_daily_costs.output_tokens + excluded.output_tokens,
      cache_read_tokens = agent_daily_costs.cache_read_tokens + excluded.cache_read_tokens,
      cache_creation_tokens = agent_daily_costs.cache_creation_tokens + excluded.cache_creation_tokens,
      request_count = agent_daily_costs.request_count + 1
  `);
  stmt.run(agentId, date, cost, inputTokens, outputTokens, cacheReadTokens, cacheCreationTokens);
}

// Get aggregated daily costs across all agents
export function getAllAgentsDailyCosts(days = 30): AgentDailyCost[] {
  const db = getDatabase();
  return db.prepare(`
    SELECT
      agent_id,
      date,
      SUM(total_cost) as total_cost,
      SUM(input_tokens) as input_tokens,
      SUM(output_tokens) as output_tokens,
      SUM(cache_read_tokens) as cache_read_tokens,
      SUM(cache_creation_tokens) as cache_creation_tokens,
      SUM(request_count) as request_count
    FROM agent_daily_costs
    WHERE date >= date('now', '-' || ? || ' days')
    GROUP BY agent_id, date
    ORDER BY date ASC
  `).all(days) as AgentDailyCost[];
}

// ============================================
// Channel Queries
// ============================================

export function upsertChannel(name: string): Channel {
  const db = getDatabase();

  // Try to insert, or get existing
  const insertStmt = db.prepare(`
    INSERT INTO channels (name)
    VALUES (?)
    ON CONFLICT(name) DO UPDATE SET name = name
  `);
  insertStmt.run(name);

  // Return the channel (either newly created or existing)
  return db.prepare('SELECT * FROM channels WHERE name = ?').get(name) as Channel;
}

export function getChannels(): Channel[] {
  const db = getDatabase();
  return db.prepare(`
    SELECT * FROM channels
    ORDER BY total_cost DESC
  `).all() as Channel[];
}

export function getChannel(id: number): Channel | undefined {
  const db = getDatabase();
  return db.prepare('SELECT * FROM channels WHERE id = ?').get(id) as Channel | undefined;
}

export function getChannelByName(name: string): Channel | undefined {
  const db = getDatabase();
  return db.prepare('SELECT * FROM channels WHERE name = ?').get(name) as Channel | undefined;
}

export function updateChannelStats(
  channelId: number,
  cost: number,
  inputTokens: number,
  outputTokens: number
): void {
  const db = getDatabase();
  const stmt = db.prepare(`
    UPDATE channels SET
      total_cost = total_cost + ?,
      total_input_tokens = total_input_tokens + ?,
      total_output_tokens = total_output_tokens + ?,
      message_count = message_count + 1
    WHERE id = ?
  `);
  stmt.run(cost, inputTokens, outputTokens, channelId);
}

export function getChannelDailyCosts(channelId: number, days = 30): ChannelDailyCost[] {
  const db = getDatabase();
  return db.prepare(`
    SELECT * FROM channel_daily_costs
    WHERE channel_id = ? AND date >= date('now', '-' || ? || ' days')
    ORDER BY date ASC
  `).all(channelId, days) as ChannelDailyCost[];
}

export function upsertChannelDailyCost(
  channelId: number,
  date: string,
  cost: number,
  inputTokens: number,
  outputTokens: number
): void {
  const db = getDatabase();
  const stmt = db.prepare(`
    INSERT INTO channel_daily_costs (channel_id, date, total_cost, input_tokens, output_tokens, message_count)
    VALUES (?, ?, ?, ?, ?, 1)
    ON CONFLICT(channel_id, date) DO UPDATE SET
      total_cost = channel_daily_costs.total_cost + excluded.total_cost,
      input_tokens = channel_daily_costs.input_tokens + excluded.input_tokens,
      output_tokens = channel_daily_costs.output_tokens + excluded.output_tokens,
      message_count = channel_daily_costs.message_count + 1
  `);
  stmt.run(channelId, date, cost, inputTokens, outputTokens);
}

// Get aggregated daily costs across all channels
export function getAllChannelsDailyCosts(days = 30): ChannelDailyCost[] {
  const db = getDatabase();
  return db.prepare(`
    SELECT
      channel_id,
      date,
      SUM(total_cost) as total_cost,
      SUM(input_tokens) as input_tokens,
      SUM(output_tokens) as output_tokens,
      SUM(message_count) as message_count
    FROM channel_daily_costs
    WHERE date >= date('now', '-' || ? || ' days')
    GROUP BY channel_id, date
    ORDER BY date ASC
  `).all(days) as ChannelDailyCost[];
}

// ============================================
// Combined Stats
// ============================================

export interface AgentStats {
  totalAgents: number;
  totalCost: number;
  totalSessions: number;
  topAgents: Array<{
    id: string;
    name: string;
    total_cost: number;
    session_count: number;
  }>;
}

export function getAgentStats(limit = 5): AgentStats {
  const db = getDatabase();

  const countRow = db.prepare('SELECT COUNT(*) as count FROM agents').get() as { count: number };

  const totalsRow = db.prepare(`
    SELECT
      COALESCE(SUM(total_cost), 0) as total_cost,
      COALESCE(SUM(session_count), 0) as total_sessions
    FROM agents
  `).get() as { total_cost: number; total_sessions: number };

  const topAgents = db.prepare(`
    SELECT id, name, total_cost, session_count
    FROM agents
    ORDER BY total_cost DESC
    LIMIT ?
  `).all(limit) as Array<{
    id: string;
    name: string;
    total_cost: number;
    session_count: number;
  }>;

  return {
    totalAgents: countRow.count,
    totalCost: totalsRow.total_cost,
    totalSessions: totalsRow.total_sessions,
    topAgents,
  };
}

export interface ChannelStats {
  totalChannels: number;
  totalCost: number;
  totalMessages: number;
  topChannels: Array<{
    id: number;
    name: string;
    total_cost: number;
    message_count: number;
  }>;
}

export function getChannelStats(limit = 5): ChannelStats {
  const db = getDatabase();

  const countRow = db.prepare('SELECT COUNT(*) as count FROM channels').get() as { count: number };

  const totalsRow = db.prepare(`
    SELECT
      COALESCE(SUM(total_cost), 0) as total_cost,
      COALESCE(SUM(message_count), 0) as total_messages
    FROM channels
  `).get() as { total_cost: number; total_messages: number };

  const topChannels = db.prepare(`
    SELECT id, name, total_cost, message_count
    FROM channels
    ORDER BY total_cost DESC
    LIMIT ?
  `).all(limit) as Array<{
    id: number;
    name: string;
    total_cost: number;
    message_count: number;
  }>;

  return {
    totalChannels: countRow.count,
    totalCost: totalsRow.total_cost,
    totalMessages: totalsRow.total_messages,
    topChannels,
  };
}
