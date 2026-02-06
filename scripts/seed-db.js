#!/usr/bin/env node

/**
 * Seed script to populate the Clawalytics database with sample data
 * Run with: node scripts/seed-db.js
 */

import Database from 'better-sqlite3';
import path from 'path';
import os from 'os';
import fs from 'fs';

const CONFIG_DIR = path.join(os.homedir(), '.clawalytics');
const DB_PATH = path.join(CONFIG_DIR, 'clawalytics.db');

// Ensure config directory exists
if (!fs.existsSync(CONFIG_DIR)) {
  fs.mkdirSync(CONFIG_DIR, { recursive: true });
}

const db = new Database(DB_PATH);
console.log(`📦 Seeding database at: ${DB_PATH}\n`);

// Helper functions
function randomBetween(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomFloat(min, max, decimals = 4) {
  return parseFloat((Math.random() * (max - min) + min).toFixed(decimals));
}

function randomChoice(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function generateId() {
  return Math.random().toString(36).substring(2, 15);
}

function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString();
}

function dateString(daysAgo) {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString().split('T')[0];
}

// Sample data
const MODELS = [
  { provider: 'anthropic', model: 'claude-sonnet-4-20250514', inputRate: 3, outputRate: 15 },
  { provider: 'anthropic', model: 'claude-opus-4-20250514', inputRate: 15, outputRate: 75 },
  { provider: 'anthropic', model: 'claude-haiku-3-5-20241022', inputRate: 0.25, outputRate: 1.25 },
  { provider: 'openai', model: 'gpt-4o', inputRate: 2.5, outputRate: 10 },
];

const PROJECTS = [
  '~/projects/web-app',
  '~/projects/api-server',
  '~/projects/mobile-app',
  '~/projects/data-pipeline',
  '~/projects/ml-service',
  '~/work/client-portal',
  '~/work/internal-tools',
];

const AGENTS = [
  { id: 'agent-support-01', name: 'Support Bot', workspace: 'customer-service' },
  { id: 'agent-sales-01', name: 'Sales Assistant', workspace: 'sales' },
  { id: 'agent-dev-01', name: 'Dev Helper', workspace: 'engineering' },
  { id: 'agent-analytics-01', name: 'Analytics Bot', workspace: 'data' },
];

const CHANNELS = [
  'whatsapp', 'telegram', 'grammy', 'discord', 'slack',
  'feishu', 'google chat', 'mattermost', 'signal', 'imessage',
  'microsoft teams', 'line', 'matrix', 'zalo'
];

const DEVICES = [
  { id: 'device-iphone-001', name: 'iPhone 15 Pro', type: 'mobile' },
  { id: 'device-android-001', name: 'Samsung Galaxy S24', type: 'mobile' },
  { id: 'device-macbook-001', name: 'MacBook Pro M3', type: 'desktop' },
  { id: 'device-ipad-001', name: 'iPad Pro', type: 'tablet' },
  { id: 'device-browser-001', name: 'Chrome Browser', type: 'browser' },
];

const TOOLS = [
  'Read', 'Write', 'Edit', 'Bash', 'Glob', 'Grep',
  'WebFetch', 'WebSearch', 'Task', 'AskUser'
];

const ALERT_TYPES = ['auth_failure', 'rate_limit', 'connection_error', 'suspicious_activity'];
const ALERT_SEVERITIES = ['low', 'medium', 'high', 'critical'];

const AUDIT_ACTIONS = [
  'device_paired', 'device_removed', 'pairing_request_created',
  'pairing_request_resolved', 'session_started', 'session_ended',
  'alert_acknowledged', 'config_updated'
];

// Clear existing data
console.log('🗑️  Clearing existing data...');
db.exec(`
  DELETE FROM audit_log;
  DELETE FROM security_alerts;
  DELETE FROM outbound_calls;
  DELETE FROM connection_events;
  DELETE FROM pairing_requests;
  DELETE FROM devices;
  DELETE FROM channel_daily_costs;
  DELETE FROM agent_daily_costs;
  DELETE FROM channels;
  DELETE FROM agents;
  DELETE FROM model_usage;
  DELETE FROM daily_costs;
  DELETE FROM requests;
  DELETE FROM sessions;
`);

// 1. Insert Sessions & Requests
console.log('📝 Creating sessions and requests...');
const sessions = [];
const insertSession = db.prepare(`
  INSERT INTO sessions (id, project_path, started_at, last_activity, total_input_tokens, total_output_tokens, total_cost, models_used, agent_id, channel, source_type)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const insertRequest = db.prepare(`
  INSERT INTO requests (session_id, timestamp, provider, model, input_tokens, output_tokens, cache_creation_tokens, cache_read_tokens, cost)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

for (let day = 0; day < 30; day++) {
  const sessionsPerDay = randomBetween(3, 8);

  for (let s = 0; s < sessionsPerDay; s++) {
    const sessionId = generateId();
    const project = randomChoice(PROJECTS);
    const isOpenClaw = Math.random() > 0.6;
    const agent = isOpenClaw ? randomChoice(AGENTS) : null;
    const channel = isOpenClaw ? randomChoice(CHANNELS) : null;

    let totalInput = 0, totalOutput = 0, totalCost = 0;
    const modelsUsed = new Set();
    const requestCount = randomBetween(5, 25);
    const requestsToInsert = [];

    // Prepare requests for this session
    for (let r = 0; r < requestCount; r++) {
      const modelInfo = randomChoice(MODELS);
      const inputTokens = randomBetween(500, 15000);
      const outputTokens = randomBetween(100, 5000);
      const cacheCreation = Math.random() > 0.7 ? randomBetween(1000, 5000) : 0;
      const cacheRead = Math.random() > 0.5 ? randomBetween(2000, 10000) : 0;

      const cost = (inputTokens * modelInfo.inputRate / 1000000) +
                   (outputTokens * modelInfo.outputRate / 1000000) +
                   (cacheCreation * modelInfo.inputRate * 1.25 / 1000000) +
                   (cacheRead * modelInfo.inputRate * 0.1 / 1000000);

      totalInput += inputTokens + cacheCreation + cacheRead;
      totalOutput += outputTokens;
      totalCost += cost;
      modelsUsed.add(modelInfo.model);

      const requestTime = new Date();
      requestTime.setDate(requestTime.getDate() - day);
      requestTime.setHours(randomBetween(8, 22), randomBetween(0, 59), randomBetween(0, 59));

      requestsToInsert.push({
        sessionId,
        timestamp: requestTime.toISOString(),
        provider: modelInfo.provider,
        model: modelInfo.model,
        inputTokens,
        outputTokens,
        cacheCreation,
        cacheRead,
        cost
      });
    }

    const startTime = new Date();
    startTime.setDate(startTime.getDate() - day);
    startTime.setHours(randomBetween(8, 20), randomBetween(0, 59));

    const endTime = new Date(startTime);
    endTime.setHours(endTime.getHours() + randomBetween(1, 4));

    // Insert session FIRST
    insertSession.run(
      sessionId,
      project,
      startTime.toISOString(),
      endTime.toISOString(),
      totalInput,
      totalOutput,
      totalCost,
      JSON.stringify([...modelsUsed]),
      agent?.id || null,
      channel,
      isOpenClaw ? 'openclaw' : 'claude-code'
    );

    // Then insert requests
    for (const req of requestsToInsert) {
      insertRequest.run(
        req.sessionId,
        req.timestamp,
        req.provider,
        req.model,
        req.inputTokens,
        req.outputTokens,
        req.cacheCreation,
        req.cacheRead,
        req.cost
      );
    }

    sessions.push({ id: sessionId, day, agent, channel, cost: totalCost });
  }
}
console.log(`   ✓ Created ${sessions.length} sessions`);

// 2. Insert Daily Costs
console.log('📊 Creating daily cost aggregates...');
const insertDailyCost = db.prepare(`
  INSERT OR REPLACE INTO daily_costs (date, total_cost, total_input_tokens, total_output_tokens, cache_creation_tokens, cache_read_tokens, cache_savings, session_count, request_count)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

for (let day = 0; day < 30; day++) {
  const date = dateString(day);
  const cost = randomFloat(5, 50);
  const inputTokens = randomBetween(100000, 500000);
  const outputTokens = randomBetween(20000, 100000);
  const cacheCreation = randomBetween(10000, 50000);
  const cacheRead = randomBetween(50000, 200000);
  const cacheSavings = randomFloat(2, 15);
  const sessionCount = randomBetween(3, 10);
  const requestCount = randomBetween(50, 200);

  insertDailyCost.run(date, cost, inputTokens, outputTokens, cacheCreation, cacheRead, cacheSavings, sessionCount, requestCount);
}
console.log('   ✓ Created 30 days of cost data');

// 3. Insert Model Usage
console.log('📈 Creating model usage data...');
const insertModelUsage = db.prepare(`
  INSERT OR REPLACE INTO model_usage (date, provider, model, input_tokens, output_tokens, cost, request_count)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`);

for (let day = 0; day < 30; day++) {
  const date = dateString(day);
  for (const modelInfo of MODELS) {
    if (Math.random() > 0.3) {
      insertModelUsage.run(
        date,
        modelInfo.provider,
        modelInfo.model,
        randomBetween(10000, 100000),
        randomBetween(5000, 50000),
        randomFloat(1, 20),
        randomBetween(10, 100)
      );
    }
  }
}
console.log('   ✓ Created model usage data');

// 4. Insert Agents
console.log('🤖 Creating agents...');
const insertAgent = db.prepare(`
  INSERT OR REPLACE INTO agents (id, name, workspace, total_cost, total_input_tokens, total_output_tokens, session_count)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`);

for (const agent of AGENTS) {
  insertAgent.run(
    agent.id,
    agent.name,
    agent.workspace,
    randomFloat(50, 300),
    randomBetween(500000, 2000000),
    randomBetween(100000, 500000),
    randomBetween(20, 100)
  );
}
console.log(`   ✓ Created ${AGENTS.length} agents`);

// 5. Insert Channels
console.log('💬 Creating channels...');
const insertChannel = db.prepare(`
  INSERT OR REPLACE INTO channels (name, total_cost, total_input_tokens, total_output_tokens, message_count)
  VALUES (?, ?, ?, ?, ?)
`);

for (const channel of CHANNELS) {
  insertChannel.run(
    channel,
    randomFloat(30, 150),
    randomBetween(200000, 800000),
    randomBetween(50000, 200000),
    randomBetween(500, 2000)
  );
}
console.log(`   ✓ Created ${CHANNELS.length} channels`);

// 6. Insert Agent Daily Costs
console.log('📅 Creating agent daily costs...');
const insertAgentDailyCost = db.prepare(`
  INSERT OR REPLACE INTO agent_daily_costs (agent_id, date, total_cost, input_tokens, output_tokens, cache_read_tokens, cache_creation_tokens, request_count)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`);

for (const agent of AGENTS) {
  for (let day = 0; day < 30; day++) {
    if (Math.random() > 0.2) {
      insertAgentDailyCost.run(
        agent.id,
        dateString(day),
        randomFloat(1, 15),
        randomBetween(10000, 80000),
        randomBetween(5000, 30000),
        randomBetween(5000, 20000),
        randomBetween(1000, 5000),
        randomBetween(5, 30)
      );
    }
  }
}
console.log('   ✓ Created agent daily costs');

// 7. Insert Channel Daily Costs
console.log('📅 Creating channel daily costs...');
const getChannelId = db.prepare('SELECT id FROM channels WHERE name = ?');
const insertChannelDailyCost = db.prepare(`
  INSERT OR REPLACE INTO channel_daily_costs (channel_id, date, total_cost, input_tokens, output_tokens, message_count)
  VALUES (?, ?, ?, ?, ?, ?)
`);

for (const channelName of CHANNELS) {
  const channel = getChannelId.get(channelName);
  if (channel) {
    for (let day = 0; day < 30; day++) {
      if (Math.random() > 0.15) {
        insertChannelDailyCost.run(
          channel.id,
          dateString(day),
          randomFloat(0.5, 8),
          randomBetween(5000, 40000),
          randomBetween(2000, 15000),
          randomBetween(20, 100)
        );
      }
    }
  }
}
console.log('   ✓ Created channel daily costs');

// 8. Insert Devices
console.log('📱 Creating devices...');
const insertDevice = db.prepare(`
  INSERT OR REPLACE INTO devices (id, name, type, paired_at, last_seen, status, connection_count)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`);

for (let i = 0; i < DEVICES.length; i++) {
  const device = DEVICES[i];
  const pairedDaysAgo = randomBetween(5, 60);
  const lastSeenDaysAgo = i < 3 ? 0 : randomBetween(0, 5);
  const status = i < 3 ? 'active' : randomChoice(['active', 'active', 'inactive']);

  insertDevice.run(
    device.id,
    device.name,
    device.type,
    daysAgo(pairedDaysAgo),
    daysAgo(lastSeenDaysAgo),
    status,
    randomBetween(10, 200)
  );
}
console.log(`   ✓ Created ${DEVICES.length} devices`);

// 9. Insert Pairing Requests
console.log('🔗 Creating pairing requests...');
const insertPairingRequest = db.prepare(`
  INSERT INTO pairing_requests (device_id, device_name, requested_at, responded_at, status, response)
  VALUES (?, ?, ?, ?, ?, ?)
`);

// Add some pending requests
insertPairingRequest.run('device-pending-001', 'Unknown Android Device', daysAgo(0), null, 'pending', null);
insertPairingRequest.run('device-pending-002', 'Firefox Browser', daysAgo(1), null, 'pending', null);

// Add some historical requests
for (let i = 0; i < 10; i++) {
  const status = randomChoice(['approved', 'approved', 'approved', 'denied']);
  const requestedAt = daysAgo(randomBetween(2, 30));
  const respondedAt = new Date(requestedAt);
  respondedAt.setHours(respondedAt.getHours() + randomBetween(1, 24));

  insertPairingRequest.run(
    `device-hist-${i}`,
    `Device ${i + 1}`,
    requestedAt,
    respondedAt.toISOString(),
    status,
    status
  );
}
console.log('   ✓ Created pairing requests (2 pending)');

// 10. Insert Connection Events
console.log('🔌 Creating connection events...');
const insertConnectionEvent = db.prepare(`
  INSERT INTO connection_events (device_id, event_type, timestamp, ip_address, details)
  VALUES (?, ?, ?, ?, ?)
`);

const eventTypes = ['connection', 'disconnection', 'auth_success', 'auth_failure', 'heartbeat'];
const ips = ['192.168.1.100', '10.0.0.50', '172.16.0.25', '192.168.1.105', '10.0.0.75'];

for (let i = 0; i < 100; i++) {
  const device = randomChoice(DEVICES);
  const hoursAgo = randomBetween(0, 48);
  const timestamp = new Date();
  timestamp.setHours(timestamp.getHours() - hoursAgo);

  insertConnectionEvent.run(
    device.id,
    randomChoice(eventTypes),
    timestamp.toISOString(),
    randomChoice(ips),
    JSON.stringify({ userAgent: 'Clawalytics/1.0' })
  );
}
console.log('   ✓ Created 100 connection events');

// 11. Insert Outbound Calls (Tools)
console.log('🔧 Creating tool calls...');
const insertOutboundCall = db.prepare(`
  INSERT INTO outbound_calls (session_id, agent_id, tool_name, timestamp, duration_ms, status, error)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`);

for (let i = 0; i < 200; i++) {
  const session = randomChoice(sessions);
  const hoursAgo = randomBetween(0, 72);
  const timestamp = new Date();
  timestamp.setHours(timestamp.getHours() - hoursAgo);
  const status = Math.random() > 0.1 ? 'success' : 'error';

  insertOutboundCall.run(
    session.id,
    session.agent?.id || null,
    randomChoice(TOOLS),
    timestamp.toISOString(),
    randomBetween(50, 5000),
    status,
    status === 'error' ? 'Timeout or connection error' : null
  );
}
console.log('   ✓ Created 200 tool calls');

// 12. Insert Security Alerts
console.log('🚨 Creating security alerts...');
const insertAlert = db.prepare(`
  INSERT INTO security_alerts (type, severity, message, timestamp, acknowledged, acknowledged_at, details)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`);

const alertMessages = {
  auth_failure: 'Failed authentication attempt detected',
  rate_limit: 'Rate limit exceeded for API calls',
  connection_error: 'Multiple connection failures from device',
  suspicious_activity: 'Unusual activity pattern detected'
};

for (let i = 0; i < 15; i++) {
  const type = randomChoice(ALERT_TYPES);
  const severity = randomChoice(ALERT_SEVERITIES);
  const hoursAgo = randomBetween(0, 72);
  const timestamp = new Date();
  timestamp.setHours(timestamp.getHours() - hoursAgo);
  const acknowledged = i > 8 ? 1 : 0;

  insertAlert.run(
    type,
    severity,
    alertMessages[type],
    timestamp.toISOString(),
    acknowledged,
    acknowledged ? daysAgo(randomBetween(0, 2)) : null,
    JSON.stringify({ deviceId: randomChoice(DEVICES).id })
  );
}
console.log('   ✓ Created 15 security alerts (6 unacknowledged)');

// 13. Insert Audit Log
console.log('📋 Creating audit log...');
const insertAuditLog = db.prepare(`
  INSERT INTO audit_log (action, entity_type, entity_id, timestamp, actor, details, ip_address)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`);

for (let i = 0; i < 100; i++) {
  const action = randomChoice(AUDIT_ACTIONS);
  const hoursAgo = randomBetween(0, 168); // Last 7 days
  const timestamp = new Date();
  timestamp.setHours(timestamp.getHours() - hoursAgo);

  let entityType = 'system';
  let entityId = null;

  if (action.includes('device') || action.includes('pairing')) {
    entityType = 'device';
    entityId = randomChoice(DEVICES).id;
  } else if (action.includes('session')) {
    entityType = 'session';
    entityId = randomChoice(sessions).id;
  } else if (action.includes('alert')) {
    entityType = 'alert';
    entityId = String(randomBetween(1, 15));
  }

  insertAuditLog.run(
    action,
    entityType,
    entityId,
    timestamp.toISOString(),
    randomChoice(['system', 'admin', 'user']),
    JSON.stringify({ automated: Math.random() > 0.5 }),
    randomChoice(ips)
  );
}
console.log('   ✓ Created 100 audit log entries');

db.close();

console.log('\n✅ Database seeded successfully!');
console.log(`   Location: ${DB_PATH}`);
console.log('\n🚀 Start the dashboard with: clawalytics start\n');
