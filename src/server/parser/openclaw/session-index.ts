import fs from 'fs';
import path from 'path';
import chokidar, { FSWatcher } from 'chokidar';

export interface SessionMetadata {
  id: string;
  startedAt: string;
  lastActivity?: string;
  messageCount?: number;
  channel?: string;
}

/**
 * Actual OpenClaw sessions.json entry format.
 * Keys are like "agent:main:main", values have this shape.
 */
interface SessionsJsonEntry {
  sessionId: string;
  updatedAt?: number;
  deliveryContext?: { channel?: string };
  lastChannel?: string;
  sessionFile?: string;
  [key: string]: unknown;
}

/**
 * Load the session index for an agent.
 * sessions.json is a map: { "agent:main:main": { sessionId, updatedAt, ... }, ... }
 */
export function loadSessionIndex(agentPath: string): SessionMetadata[] {
  const indexPath = path.join(agentPath, 'sessions', 'sessions.json');

  if (!fs.existsSync(indexPath)) {
    return [];
  }

  try {
    const content = fs.readFileSync(indexPath, 'utf-8');
    const index = JSON.parse(content) as Record<string, SessionsJsonEntry>;

    const sessions: SessionMetadata[] = [];

    for (const [, entry] of Object.entries(index)) {
      if (!entry || typeof entry !== 'object' || !entry.sessionId) continue;

      sessions.push({
        id: entry.sessionId,
        startedAt: entry.updatedAt
          ? new Date(entry.updatedAt).toISOString()
          : new Date().toISOString(),
        channel: entry.deliveryContext?.channel || entry.lastChannel,
      });
    }

    return sessions;
  } catch (error) {
    console.error(`Failed to load session index from ${indexPath}:`, error);
    return [];
  }
}

/**
 * Watch the session index file for new sessions
 */
export function watchSessionIndex(
  agentPath: string,
  onNewSession: (session: SessionMetadata) => void
): FSWatcher | null {
  const indexPath = path.join(agentPath, 'sessions', 'sessions.json');

  if (!fs.existsSync(path.dirname(indexPath))) {
    console.log(`Sessions directory does not exist for agent at ${agentPath}`);
    return null;
  }

  // Track known sessions to detect new ones
  const knownSessions = new Set<string>();

  // Load initial sessions
  const initialSessions = loadSessionIndex(agentPath);
  for (const session of initialSessions) {
    knownSessions.add(session.id);
  }

  const watcher = chokidar.watch(indexPath, {
    persistent: true,
    ignoreInitial: true,
  });

  watcher.on('change', () => {
    const sessions = loadSessionIndex(agentPath);

    for (const session of sessions) {
      if (!knownSessions.has(session.id)) {
        knownSessions.add(session.id);
        console.log(`New OpenClaw session detected: ${session.id}`);
        onNewSession(session);
      }
    }
  });

  watcher.on('add', () => {
    const sessions = loadSessionIndex(agentPath);

    for (const session of sessions) {
      if (!knownSessions.has(session.id)) {
        knownSessions.add(session.id);
        console.log(`New OpenClaw session detected: ${session.id}`);
        onNewSession(session);
      }
    }
  });

  watcher.on('error', (error) => {
    console.error(`Error watching session index at ${indexPath}:`, error);
  });

  return watcher;
}

/**
 * Get the path to a session's JSONL file
 */
export function getSessionLogPath(agentPath: string, sessionId: string): string {
  return path.join(agentPath, 'sessions', `${sessionId}.jsonl`);
}

/**
 * List all session JSONL files for an agent
 */
export function listSessionFiles(agentPath: string): string[] {
  const sessionsDir = path.join(agentPath, 'sessions');

  if (!fs.existsSync(sessionsDir)) {
    return [];
  }

  try {
    const files = fs.readdirSync(sessionsDir);
    return files
      .filter((file) => file.endsWith('.jsonl'))
      .map((file) => path.join(sessionsDir, file));
  } catch (error) {
    console.error(`Failed to list session files in ${sessionsDir}:`, error);
    return [];
  }
}
