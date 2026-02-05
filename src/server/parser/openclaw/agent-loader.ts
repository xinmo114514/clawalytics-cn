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
 * Load agents from the OpenClaw config file
 */
export function loadAgents(openClawPath: string): OpenClawAgent[] {
  const configPath = path.join(openClawPath, 'openclaw.json');

  if (!fs.existsSync(configPath)) {
    return [];
  }

  try {
    const content = fs.readFileSync(configPath, 'utf-8');
    const config = JSON.parse(content) as OpenClawConfig;

    if (!config.agents || !Array.isArray(config.agents)) {
      console.warn('OpenClaw config has no agents array');
      return [];
    }

    return config.agents.map((agent) => ({
      id: agent.id,
      name: agent.name,
      workspace: agent.workspace,
    }));
  } catch (error) {
    console.error('Failed to load OpenClaw config:', error);
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
