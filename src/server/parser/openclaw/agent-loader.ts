import fs from 'fs';
import path from 'path';
import chokidar, { FSWatcher } from 'chokidar';

export interface OpenClawAgent {
  id: string;
  name: string;
  workspace?: string;
}

export interface OpenClawConfig {
  agents: OpenClawAgent[];
}

/**
 * Load agents from the OpenClaw config file, falling back to filesystem discovery
 */
export function loadAgents(openClawPath: string): OpenClawAgent[] {
  // First try config file
  const configPath = path.join(openClawPath, 'openclaw.json');
  if (fs.existsSync(configPath)) {
    try {
      const content = fs.readFileSync(configPath, 'utf-8');
      const config = JSON.parse(content) as OpenClawConfig;
      if (config.agents && Array.isArray(config.agents) && config.agents.length > 0) {
        return config.agents.map((agent) => ({
          id: agent.id,
          name: agent.name,
          workspace: agent.workspace,
        }));
      }
    } catch {
      // Fall through to filesystem discovery
    }
  }

  // Fall back to discovering agents from filesystem
  return discoverAgents(openClawPath);
}

/**
 * Discover agents by scanning ~/.openclaw/agents/ directory.
 * Each subdirectory that contains a sessions/ folder is an agent.
 */
export function discoverAgents(openClawPath: string): OpenClawAgent[] {
  const agentsDir = path.join(openClawPath, 'agents');
  if (!fs.existsSync(agentsDir)) {
    return [];
  }

  try {
    const entries = fs.readdirSync(agentsDir, { withFileTypes: true });
    const agents: OpenClawAgent[] = [];

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;

      const sessionsDir = path.join(agentsDir, entry.name, 'sessions');
      if (fs.existsSync(sessionsDir)) {
        agents.push({
          id: entry.name,
          name: entry.name,
          workspace: path.join(agentsDir, entry.name),
        });
      }
    }

    if (agents.length > 0) {
      console.log(`Discovered ${agents.length} OpenClaw agent(s) from filesystem: ${agents.map(a => a.id).join(', ')}`);
    }

    return agents;
  } catch (error) {
    console.error('Failed to discover agents from filesystem:', error);
    return [];
  }
}

/**
 * Watch the OpenClaw config file for changes and notify when agents are updated
 */
export function watchAgentConfig(
  openClawPath: string,
  onChange: (agents: OpenClawAgent[]) => void
): FSWatcher | null {
  const configPath = path.join(openClawPath, 'openclaw.json');

  if (!fs.existsSync(openClawPath)) {
    console.log('OpenClaw path does not exist, skipping agent config watcher');
    return null;
  }

  const watcher = chokidar.watch(configPath, {
    persistent: true,
    ignoreInitial: true,
  });

  watcher.on('change', () => {
    console.log('OpenClaw config changed, reloading agents...');
    const agents = loadAgents(openClawPath);
    onChange(agents);
  });

  watcher.on('add', () => {
    console.log('OpenClaw config created, loading agents...');
    const agents = loadAgents(openClawPath);
    onChange(agents);
  });

  watcher.on('error', (error) => {
    console.error('Error watching OpenClaw config:', error);
  });

  return watcher;
}
