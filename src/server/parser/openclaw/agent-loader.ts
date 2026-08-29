import path from 'path'
import chokidar, { type FSWatcher } from 'chokidar'
import fs from 'fs'
import JSON5 from 'json5'

function shouldUsePollingWatcher(filePath: string): boolean {
  const normalized = filePath.replace(/\\/g, '/').toLowerCase()
  return (
    normalized.startsWith('//wsl.localhost/') ||
    normalized.startsWith('//wsl$/')
  )
}

export interface OpenClawAgent {
  id: string
  name: string
  workspace?: string
}

export interface OpenClawConfig {
  agents?:
    | OpenClawAgent[]
    | {
        list?: OpenClawAgent[]
        entries?: Record<string, Omit<OpenClawAgent, 'id'>>
        defaults?: { workspace?: string }
      }
}

function normalizeAgentId(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const id = value.trim()
  if (!id || id === '.' || id === '..' || /[\\/]/.test(id)) {
    return undefined
  }
  return id
}

function normalizeWorkspace(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const workspace = value.trim()
  return workspace || undefined
}

function normalizeAgents(config: OpenClawConfig): OpenClawAgent[] {
  if (Array.isArray(config.agents)) {
    return config.agents
      .map((agent) => ({ agent, id: normalizeAgentId(agent?.id) }))
      .filter((entry): entry is { agent: OpenClawAgent; id: string } =>
        Boolean(entry.id)
      )
      .map(({ agent, id }) => ({
        id,
        name:
          typeof agent.name === 'string' && agent.name.trim()
            ? agent.name.trim()
            : id,
        workspace: normalizeWorkspace(agent.workspace),
      }))
  }

  const agentConfig = config.agents
  if (!agentConfig || Array.isArray(agentConfig)) {
    return []
  }

  const defaultsWorkspace = normalizeWorkspace(agentConfig.defaults?.workspace)
  const configured = Array.isArray(agentConfig.list)
    ? agentConfig.list
    : Object.entries(agentConfig.entries ?? {}).map(([id, agent]) => ({
        id,
        ...agent,
      }))

  return configured
    .map((agent) => ({ agent, id: normalizeAgentId(agent?.id) }))
    .filter((entry): entry is { agent: OpenClawAgent; id: string } =>
      Boolean(entry.id)
    )
    .map(({ agent, id }) => ({
      id,
      name:
        typeof agent.name === 'string' && agent.name.trim()
          ? agent.name.trim()
          : id,
      workspace: normalizeWorkspace(agent.workspace) ?? defaultsWorkspace,
    }))
}

/**
 * Load agents from the OpenClaw config file, falling back to filesystem discovery
 */
export function loadAgents(openClawPath: string): OpenClawAgent[] {
  // First try config file
  const configPath = path.join(openClawPath, 'openclaw.json')
  if (fs.existsSync(configPath)) {
    try {
      const content = fs.readFileSync(configPath, 'utf-8')
      const config = JSON5.parse(content) as OpenClawConfig
      const agents = normalizeAgents(config)
      if (agents.length > 0) {
        return agents
      }
    } catch {
      // Fall through to filesystem discovery
    }
  }

  // Fall back to discovering agents from filesystem
  return discoverAgents(openClawPath)
}

/**
 * Discover agents by scanning ~/.openclaw/agents/ directory.
 * Each subdirectory that contains a sessions/ folder is an agent.
 */
export function discoverAgents(openClawPath: string): OpenClawAgent[] {
  const agentsDir = path.join(openClawPath, 'agents')
  if (!fs.existsSync(agentsDir)) {
    return []
  }

  try {
    const entries = fs.readdirSync(agentsDir, { withFileTypes: true })
    const agents: OpenClawAgent[] = []

    for (const entry of entries) {
      if (!entry.isDirectory()) continue

      const agentPath = path.join(agentsDir, entry.name)
      const sessionsDir = path.join(agentPath, 'sessions')
      const databasePath = path.join(
        agentPath,
        'agent',
        'openclaw-agent.sqlite'
      )
      if (fs.existsSync(sessionsDir) || fs.existsSync(databasePath)) {
        agents.push({
          id: entry.name,
          name: entry.name,
          workspace: agentPath,
        })
      }
    }

    if (agents.length > 0) {
      console.log(
        `Discovered ${agents.length} OpenClaw agent(s) from filesystem: ${agents.map((a) => a.id).join(', ')}`
      )
    }

    return agents
  } catch (error) {
    console.error('Failed to discover agents from filesystem:', error)
    return []
  }
}

/**
 * Watch the OpenClaw config file for changes and notify when agents are updated
 */
export function watchAgentConfig(
  openClawPath: string,
  onChange: (agents: OpenClawAgent[]) => void
): FSWatcher | null {
  const configPath = path.join(openClawPath, 'openclaw.json')

  if (!fs.existsSync(openClawPath)) {
    console.log('OpenClaw path does not exist, skipping agent config watcher')
    return null
  }

  const watcher = chokidar.watch(configPath, {
    persistent: true,
    ignoreInitial: true,
    usePolling: shouldUsePollingWatcher(configPath),
    interval: 1000,
    awaitWriteFinish: { stabilityThreshold: 300, pollInterval: 50 },
  })

  watcher.on('change', () => {
    console.log('OpenClaw config changed, reloading agents...')
    const agents = loadAgents(openClawPath)
    onChange(agents)
  })

  watcher.on('add', () => {
    console.log('OpenClaw config created, loading agents...')
    const agents = loadAgents(openClawPath)
    onChange(agents)
  })

  watcher.on('error', (error) => {
    console.error('Error watching OpenClaw config:', error)
  })

  return watcher
}
