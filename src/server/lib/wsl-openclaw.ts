import path from 'path'
import { execFileSync } from 'child_process'
import fs from 'fs'
import os from 'os'

const WSL_COMMAND_TIMEOUT_MS = 4000
const WSL_CACHE_TTL_MS = 30000
const WSL_UNC_PATTERN = /^\\\\(?:wsl\$|wsl\.localhost)\\([^\\/]+)([\\/].*)?$/i

export const DEFAULT_WSL_OPENCLAW_PATH = '~/.openclaw'

export interface WslOpenClawSettings {
  enabled?: boolean
  distro?: string
  openClawPath?: string
}

export interface WslDistribution {
  name: string
  isDefault: boolean
  version?: number
  state?: string
}

export interface WslAvailability {
  available: boolean
  distro?: string
  distributions: WslDistribution[]
  error?: string
  details?: string
}

export interface ResolvedOpenClawPath {
  originalPath: string
  hostPath: string
  source: 'local' | 'wsl-unc' | 'wsl-linux'
  isWsl: boolean
  distro?: string
  linuxPath?: string
  error?: string
  warnings: string[]
}

let distributionCache: { expiresAt: number; value: WslDistribution[] } | null =
  null
let defaultOpenClawPathCache: {
  expiresAt: number
  value: ResolvedOpenClawPath | null
} | null = null
const homePathCache = new Map<
  string,
  { expiresAt: number; value: string | null }
>()

function stripWrappingQuotes(value: string): string {
  const trimmed = value.trim()
  if (
    trimmed.length >= 2 &&
    ((trimmed.startsWith('"') && trimmed.endsWith('"')) ||
      (trimmed.startsWith("'") && trimmed.endsWith("'")))
  ) {
    return trimmed.slice(1, -1).trim()
  }
  return trimmed
}

export function cleanPathInput(value?: string | null): string | undefined {
  if (typeof value !== 'string') {
    return undefined
  }

  const cleaned = stripWrappingQuotes(value)
  return cleaned ? cleaned : undefined
}

function expandHostHomeDirectory(value: string): string {
  if (value === '~') {
    return os.homedir()
  }

  if (value.startsWith('~/') || value.startsWith('~\\')) {
    return path.join(os.homedir(), value.slice(2))
  }

  return value
}

function decodeWslOutput(buffer: Buffer): string {
  const utf8 = buffer.toString('utf8')
  const nulCount = (utf8.match(/\0/g) ?? []).length

  if (nulCount > Math.max(2, utf8.length / 8)) {
    return buffer.toString('utf16le').replaceAll('\0', '')
  }

  return utf8.replaceAll('\0', '')
}

function runWslCommand(args: string[]): string | null {
  try {
    const output = execFileSync('wsl.exe', args, {
      timeout: WSL_COMMAND_TIMEOUT_MS,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    return decodeWslOutput(output).trim()
  } catch {
    return null
  }
}

function runInDistro(distro: string, script: string): string | null {
  return runWslCommand(['-d', distro, 'sh', '-lc', script])
}

function parseWslListVerbose(output: string): WslDistribution[] {
  const lines = output
    .split(/\r?\n/)
    .map((line) => line.replaceAll('\0', '').trimEnd())
    .filter((line) => line.trim())

  const distros: WslDistribution[] = []

  for (const line of lines) {
    if (/^\s*NAME\s+STATE\s+VERSION\s*$/i.test(line.trim())) {
      continue
    }

    const isDefault = /^\s*\*/.test(line)
    const withoutMarker = line.replace(/^\s*\*\s*/, '').trim()
    if (!withoutMarker) {
      continue
    }

    const match = withoutMarker.match(/^(.*?)\s{2,}([A-Za-z]+)\s+(\d+)\s*$/)
    if (match) {
      distros.push({
        name: match[1].trim(),
        isDefault,
        state: match[2],
        version: Number.parseInt(match[3], 10),
      })
      continue
    }

    const fallbackParts = withoutMarker.split(/\s{2,}/)
    distros.push({
      name: fallbackParts[0].trim(),
      isDefault,
    })
  }

  return distros.filter((distro) => distro.name)
}

function parseWslListQuiet(output: string): WslDistribution[] {
  return output
    .split(/\r?\n/)
    .map((line) => line.replaceAll('\0', '').trim())
    .filter(Boolean)
    .map((name, index) => ({ name, isDefault: index === 0 }))
}

export function listWslDistributions(): WslDistribution[] {
  if (process.platform !== 'win32') {
    return []
  }

  if (distributionCache && distributionCache.expiresAt > Date.now()) {
    return distributionCache.value
  }

  const verboseOutput = runWslCommand(['-l', '-v'])
  if (verboseOutput) {
    const parsed = parseWslListVerbose(verboseOutput)
    if (parsed.length > 0) {
      distributionCache = {
        expiresAt: Date.now() + WSL_CACHE_TTL_MS,
        value: parsed,
      }
      return parsed
    }
  }

  const quietOutput = runWslCommand(['-l', '-q'])
  const parsed = quietOutput ? parseWslListQuiet(quietOutput) : []
  distributionCache = {
    expiresAt: Date.now() + WSL_CACHE_TTL_MS,
    value: parsed,
  }
  return parsed
}

export function getDefaultWslDistroName(): string | undefined {
  const distros = listWslDistributions()
  return distros.find((distro) => distro.isDefault)?.name ?? distros[0]?.name
}

export function isWslUncPath(value: string): boolean {
  return WSL_UNC_PATTERN.test(value)
}

export function parseWslUncPath(value: string): {
  distro: string
  linuxPath: string
} | null {
  const match = value.match(WSL_UNC_PATTERN)
  if (!match) {
    return null
  }

  const rest = (match[2] ?? '').replace(/\\/g, '/')
  return {
    distro: match[1],
    linuxPath: rest ? `/${rest.replace(/^\/+/, '')}` : '/',
  }
}

function isLikelyLinuxPath(value: string): boolean {
  return value === '~' || value.startsWith('~/') || value.startsWith('/')
}

function getWslHomePath(distro: string): string | null {
  const cached = homePathCache.get(distro)
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value
  }

  const value = runInDistro(distro, 'printf "%s" "$HOME"')
  homePathCache.set(distro, {
    expiresAt: Date.now() + WSL_CACHE_TTL_MS,
    value,
  })
  return value
}

function normalizeLinuxPath(
  value: string,
  distro: string
): {
  linuxPath?: string
  error?: string
} {
  const normalized = value.replace(/\\/g, '/')

  if (normalized === '~' || normalized.startsWith('~/')) {
    const home = getWslHomePath(distro)
    if (!home) {
      return {
        error: `Unable to resolve the home directory for WSL distribution "${distro}".`,
      }
    }

    const suffix = normalized === '~' ? '' : normalized.slice(1)
    return { linuxPath: `${home}${suffix}` }
  }

  if (!normalized.startsWith('/')) {
    return {
      error: `WSL paths must be absolute Linux paths such as ${DEFAULT_WSL_OPENCLAW_PATH} or /home/user/.openclaw.`,
    }
  }

  return { linuxPath: normalized }
}

export function linuxPathToWslUncPath(
  distro: string,
  linuxPath: string
): string {
  const parts = linuxPath.replace(/\\/g, '/').split('/').filter(Boolean)

  return `\\\\wsl$\\${distro}${parts.length > 0 ? `\\${parts.join('\\')}` : ''}`
}

export function getWslAvailability(distroName?: string): WslAvailability {
  if (process.platform !== 'win32') {
    return {
      available: false,
      distributions: [],
      error:
        'WSL2 access is only required when Clawalytics is running on Windows.',
    }
  }

  const distributions = listWslDistributions()
  if (distributions.length === 0) {
    return {
      available: false,
      distributions,
      error:
        'No WSL distributions were found. Install WSL2 and an OpenClaw distribution first.',
    }
  }

  const distro = distroName
    ? distributions.find((candidate) => candidate.name === distroName)
    : (distributions.find((candidate) => candidate.isDefault) ??
      distributions[0])

  if (!distro) {
    return {
      available: false,
      distributions,
      error: `WSL distribution "${distroName}" was not found.`,
    }
  }

  if (distro.version !== undefined && distro.version !== 2) {
    return {
      available: false,
      distro: distro.name,
      distributions,
      error: `WSL distribution "${distro.name}" is version ${distro.version}; WSL2 is required for direct filesystem access.`,
    }
  }

  const probe = runInDistro(distro.name, 'printf ok')
  if (probe !== 'ok') {
    return {
      available: false,
      distro: distro.name,
      distributions,
      error: `Unable to communicate with WSL distribution "${distro.name}". Start WSL2 and try again.`,
    }
  }

  return {
    available: true,
    distro: distro.name,
    distributions,
    details: distro.state ? `Distribution state: ${distro.state}` : undefined,
  }
}

export function resolveOpenClawDataPath(
  openClawPath?: string | null,
  wsl?: WslOpenClawSettings
): ResolvedOpenClawPath | undefined {
  const cleanedOpenClawPath = cleanPathInput(openClawPath)
  const explicitWsl = Boolean(wsl?.enabled)
  const configuredWslPath = cleanPathInput(wsl?.openClawPath)
  const rawPath = explicitWsl
    ? (configuredWslPath ?? cleanedOpenClawPath ?? DEFAULT_WSL_OPENCLAW_PATH)
    : cleanedOpenClawPath

  if (!rawPath) {
    return undefined
  }

  if (process.platform === 'win32') {
    const unc = parseWslUncPath(rawPath)
    if (unc) {
      return {
        originalPath: rawPath,
        hostPath: rawPath,
        source: 'wsl-unc',
        isWsl: true,
        distro: unc.distro,
        linuxPath: unc.linuxPath,
        warnings: [],
      }
    }

    if (explicitWsl || isLikelyLinuxPath(rawPath)) {
      const distro = cleanPathInput(wsl?.distro) ?? getDefaultWslDistroName()
      if (!distro) {
        return {
          originalPath: rawPath,
          hostPath: rawPath,
          source: 'wsl-linux',
          isWsl: true,
          error:
            'No WSL distribution is available. Configure a WSL2 distribution name or install WSL2.',
          warnings: [],
        }
      }

      const normalized = normalizeLinuxPath(rawPath, distro)
      if (normalized.error || !normalized.linuxPath) {
        return {
          originalPath: rawPath,
          hostPath: rawPath,
          source: 'wsl-linux',
          isWsl: true,
          distro,
          error: normalized.error,
          warnings: [],
        }
      }

      return {
        originalPath: rawPath,
        hostPath: linuxPathToWslUncPath(distro, normalized.linuxPath),
        source: 'wsl-linux',
        isWsl: true,
        distro,
        linuxPath: normalized.linuxPath,
        warnings: [],
      }
    }
  }

  const hostPath = path.resolve(expandHostHomeDirectory(rawPath))
  return {
    originalPath: rawPath,
    hostPath,
    source: 'local',
    isWsl: false,
    warnings: [],
  }
}

export function detectDefaultWslOpenClawPath(): ResolvedOpenClawPath | null {
  if (process.platform !== 'win32') {
    return null
  }

  if (
    defaultOpenClawPathCache &&
    defaultOpenClawPathCache.expiresAt > Date.now()
  ) {
    return defaultOpenClawPathCache.value
  }

  const distributions = listWslDistributions()
  const ordered = [
    ...distributions.filter((distro) => distro.isDefault),
    ...distributions.filter((distro) => !distro.isDefault),
  ]

  for (const distro of ordered) {
    if (distro.version !== undefined && distro.version !== 2) {
      continue
    }

    const linuxPath = runInDistro(
      distro.name,
      'p="${HOME}/.openclaw"; [ -d "$p" ] && printf "%s" "$p"'
    )

    if (!linuxPath) {
      continue
    }

    const hostPath = linuxPathToWslUncPath(distro.name, linuxPath)
    if (!fs.existsSync(hostPath)) {
      continue
    }

    const resolved = {
      originalPath: linuxPath,
      hostPath,
      source: 'wsl-linux',
      isWsl: true,
      distro: distro.name,
      linuxPath,
      warnings: [],
    } satisfies ResolvedOpenClawPath
    defaultOpenClawPathCache = {
      expiresAt: Date.now() + WSL_CACHE_TTL_MS,
      value: resolved,
    }
    return resolved
  }

  defaultOpenClawPathCache = {
    expiresAt: Date.now() + WSL_CACHE_TTL_MS,
    value: null,
  }
  return null
}
