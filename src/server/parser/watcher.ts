import chokidar, { FSWatcher } from 'chokidar';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { parseLogLine, clearSessionCache, detectSourceType } from './parser.js';
import { loadAgents, watchAgentConfig, type OpenClawAgent } from './openclaw/agent-loader.js';
import { parseOpenClawLine } from './openclaw/session-parser.js';
import { listSessionFiles } from './openclaw/session-index.js';
import {
  upsertAgent,
  updateAgentStats,
  upsertAgentDailyCost,
  upsertChannel,
  updateChannelStats,
  upsertChannelDailyCost,
  incrementAgentSessionCount,
} from '../db/queries-agents.js';

// Claude Code watcher
let watcher: FSWatcher | null = null;
const filePositions = new Map<string, number>();

// OpenClaw watchers
let openClawWatcher: FSWatcher | null = null;
let openClawConfigWatcher: FSWatcher | null = null;
const openClawFilePositions = new Map<string, number>();
const trackedAgentSessions = new Set<string>(); // Track agent:session combinations

export function startWatcher(logPath: string): void {
  if (watcher) {
    console.log('Watcher already running, stopping previous instance...');
    stopWatcher();
  }

  if (!fs.existsSync(logPath)) {
    console.warn(`Log path does not exist: ${logPath}`);
    // Create the directory if it doesn't exist
    try {
      fs.mkdirSync(logPath, { recursive: true });
      console.log(`Created log directory: ${logPath}`);
    } catch (error) {
      console.error(`Failed to create log directory: ${error}`);
      return;
    }
  }

  // Watch for JSONL files
  const globPattern = path.join(logPath, '**', '*.jsonl');

  watcher = chokidar.watch(globPattern, {
    persistent: true,
    ignoreInitial: false,
    followSymlinks: true,
    depth: 5,
    awaitWriteFinish: {
      stabilityThreshold: 100,
      pollInterval: 50,
    },
  });

  watcher.on('add', (filePath) => {
    console.log(`New log file detected: ${filePath}`);
    processExistingFile(filePath);
  });

  watcher.on('change', (filePath) => {
    processFileChanges(filePath);
  });

  watcher.on('error', (error) => {
    console.error('Watcher error:', error);
  });

  console.log(`Watching for JSONL files in: ${logPath}`);
}

export function stopWatcher(): void {
  if (watcher) {
    watcher.close();
    watcher = null;
    filePositions.clear();
    clearSessionCache();
    console.log('File watcher stopped');
  }
}

function processExistingFile(filePath: string): void {
  try {
    const stats = fs.statSync(filePath);
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');

    const projectPath = extractProjectPath(filePath);

    for (const line of lines) {
      if (line.trim()) {
        parseLogLine(line, projectPath);
      }
    }

    // Track file position for future changes
    filePositions.set(filePath, stats.size);
  } catch (error) {
    console.error(`Error processing file ${filePath}:`, error);
  }
}

function processFileChanges(filePath: string): void {
  try {
    const stats = fs.statSync(filePath);
    const previousPosition = filePositions.get(filePath) || 0;

    if (stats.size <= previousPosition) {
      // File was truncated or hasn't grown
      if (stats.size < previousPosition) {
        // File was truncated, re-read from beginning
        filePositions.set(filePath, 0);
        processExistingFile(filePath);
      }
      return;
    }

    // Read only the new content
    const fd = fs.openSync(filePath, 'r');
    const newBytes = stats.size - previousPosition;
    const buffer = Buffer.alloc(newBytes);
    fs.readSync(fd, buffer, 0, newBytes, previousPosition);
    fs.closeSync(fd);

    const newContent = buffer.toString('utf-8');
    const lines = newContent.split('\n');
    const projectPath = extractProjectPath(filePath);

    for (const line of lines) {
      if (line.trim()) {
        parseLogLine(line, projectPath);
      }
    }

    filePositions.set(filePath, stats.size);
  } catch (error) {
    console.error(`Error processing file changes ${filePath}:`, error);
  }
}

function extractProjectPath(filePath: string): string {
  // Extract project identifier from path
  // Example: ~/.claude/projects/-Users-name-project-name/session.jsonl
  const parts = filePath.split('/');
  const projectsIndex = parts.indexOf('projects');

  if (projectsIndex !== -1 && projectsIndex < parts.length - 1) {
    return parts[projectsIndex + 1];
  }

  return path.dirname(filePath);
}

export function isWatcherRunning(): boolean {
  return watcher !== null;
}

// ============================================
// OpenClaw Watcher Functions
// ============================================

const DEFAULT_OPENCLAW_PATH = path.join(os.homedir(), '.openclaw');

export function startOpenClawWatcher(openClawPath?: string): void {
  const watchPath = openClawPath || DEFAULT_OPENCLAW_PATH;

  if (openClawWatcher) {
    console.log('OpenClaw watcher already running, stopping previous instance...');
    stopOpenClawWatcher();
  }

  if (!fs.existsSync(watchPath)) {
    console.log(`OpenClaw path does not exist: ${watchPath}, skipping OpenClaw watcher`);
    return;
  }

  // Load and register agents from config
  const agents = loadAgents(watchPath);
  for (const agent of agents) {
    registerAgent(agent);
  }

  // Watch for config changes
  openClawConfigWatcher = watchAgentConfig(watchPath, (updatedAgents) => {
    for (const agent of updatedAgents) {
      registerAgent(agent);
    }
  });

  // Watch for session JSONL files
  const globPattern = path.join(watchPath, 'agents', '*', 'sessions', '*.jsonl');

  openClawWatcher = chokidar.watch(globPattern, {
    persistent: true,
    ignoreInitial: false,
    followSymlinks: true,
    depth: 5,
    awaitWriteFinish: {
      stabilityThreshold: 100,
      pollInterval: 50,
    },
  });

  openClawWatcher.on('add', (filePath) => {
    console.log(`New OpenClaw session file detected: ${filePath}`);
    processOpenClawFile(filePath);
  });

  openClawWatcher.on('change', (filePath) => {
    processOpenClawFileChanges(filePath);
  });

  openClawWatcher.on('error', (error) => {
    console.error('OpenClaw watcher error:', error);
  });

  console.log(`Watching for OpenClaw sessions in: ${watchPath}`);
}

export function stopOpenClawWatcher(): void {
  if (openClawWatcher) {
    openClawWatcher.close();
    openClawWatcher = null;
  }
  if (openClawConfigWatcher) {
    openClawConfigWatcher.close();
    openClawConfigWatcher = null;
  }
  openClawFilePositions.clear();
  trackedAgentSessions.clear();
  console.log('OpenClaw watcher stopped');
}

export function isOpenClawWatcherRunning(): boolean {
  return openClawWatcher !== null;
}

function registerAgent(agent: OpenClawAgent): void {
  upsertAgent({
    id: agent.id,
    name: agent.name,
    workspace: agent.workspace,
  });
  console.log(`Registered OpenClaw agent: ${agent.name} (${agent.id})`);
}

function extractOpenClawInfo(filePath: string): { agentId: string; sessionId: string } | null {
  // Path format: ~/.openclaw/agents/<agentId>/sessions/<sessionId>.jsonl
  const parts = filePath.split(path.sep);
  const agentsIndex = parts.indexOf('agents');

  if (agentsIndex === -1 || agentsIndex + 3 >= parts.length) {
    return null;
  }

  const agentId = parts[agentsIndex + 1];
  const filename = parts[parts.length - 1];
  const sessionId = filename.replace('.jsonl', '');

  return { agentId, sessionId };
}

function processOpenClawFile(filePath: string): void {
  const info = extractOpenClawInfo(filePath);
  if (!info) {
    console.warn(`Could not extract agent/session info from path: ${filePath}`);
    return;
  }

  const { agentId, sessionId } = info;

  try {
    const stats = fs.statSync(filePath);
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');

    // Track this as a new session if not seen before
    const sessionKey = `${agentId}:${sessionId}`;
    if (!trackedAgentSessions.has(sessionKey)) {
      trackedAgentSessions.add(sessionKey);
      incrementAgentSessionCount(agentId);
    }

    for (const line of lines) {
      if (line.trim()) {
        processOpenClawLine(line, sessionId, agentId);
      }
    }

    openClawFilePositions.set(filePath, stats.size);
  } catch (error) {
    console.error(`Error processing OpenClaw file ${filePath}:`, error);
  }
}

function processOpenClawFileChanges(filePath: string): void {
  const info = extractOpenClawInfo(filePath);
  if (!info) return;

  const { agentId, sessionId } = info;

  try {
    const stats = fs.statSync(filePath);
    const previousPosition = openClawFilePositions.get(filePath) || 0;

    if (stats.size <= previousPosition) {
      if (stats.size < previousPosition) {
        // File was truncated, re-read from beginning
        openClawFilePositions.set(filePath, 0);
        processOpenClawFile(filePath);
      }
      return;
    }

    // Read only the new content
    const fd = fs.openSync(filePath, 'r');
    const newBytes = stats.size - previousPosition;
    const buffer = Buffer.alloc(newBytes);
    fs.readSync(fd, buffer, 0, newBytes, previousPosition);
    fs.closeSync(fd);

    const newContent = buffer.toString('utf-8');
    const lines = newContent.split('\n');

    for (const line of lines) {
      if (line.trim()) {
        processOpenClawLine(line, sessionId, agentId);
      }
    }

    openClawFilePositions.set(filePath, stats.size);
  } catch (error) {
    console.error(`Error processing OpenClaw file changes ${filePath}:`, error);
  }
}

function processOpenClawLine(line: string, sessionId: string, agentId: string): void {
  const result = parseOpenClawLine(line, sessionId, agentId);
  if (!result) return;

  const {
    timestamp,
    inputTokens,
    outputTokens,
    cacheCreationTokens,
    cacheReadTokens,
    cost,
    origin,
  } = result;

  const date = timestamp.split('T')[0];

  // Update agent stats
  updateAgentStats(agentId, cost, inputTokens, outputTokens);
  upsertAgentDailyCost(
    agentId,
    date,
    cost,
    inputTokens,
    outputTokens,
    cacheReadTokens,
    cacheCreationTokens
  );

  // Update channel stats if origin data is present
  if (origin) {
    const channelName = `${origin.provider}:${origin.channel}`;
    const channel = upsertChannel(channelName);
    updateChannelStats(channel.id, cost, inputTokens, outputTokens);
    upsertChannelDailyCost(channel.id, date, cost, inputTokens, outputTokens);
  }
}
