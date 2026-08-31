import path from 'path'
import fs from 'fs'
import os from 'os'
import yaml from 'yaml'
import { convertUsdToCny } from '../lib/currency.js'
import {
  DEFAULT_WSL_OPENCLAW_PATH,
  detectDefaultWslOpenClawPath,
  isWslUncPath,
  parseWslUncPath,
  resolveDataSourcePath,
  resolveOpenClawDataPath,
  type WslOpenClawSettings,
} from '../lib/wsl-openclaw.js'
import {
  DEFAULT_CONFIG,
  DEFAULT_RATES,
  type Config,
  type DataSourceEnvironment,
  type DefaultRates,
} from './defaults.js'

// Re-export types for use in other modules
export type { Config, DefaultRates, ProviderRates } from './defaults.js'
export type { DataSourceEnvironment } from './defaults.js'

const CONFIG_DIR = path.join(os.homedir(), '.clawalytics')
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.yaml')

const LEGACY_DEFAULT_RATES: DefaultRates = {
  anthropic: {
    'claude-opus-4': { input: 15, output: 75 },
    'claude-opus-4-5': { input: 15, output: 75 },
    'claude-opus-4-5-20251101': { input: 15, output: 75 },
    'claude-sonnet-4': { input: 3, output: 15 },
    'claude-sonnet-4-20250514': { input: 3, output: 15 },
    'claude-3-5-sonnet-20241022': { input: 3, output: 15 },
    'claude-haiku': { input: 0.25, output: 1.25 },
    'claude-3-haiku-20240307': { input: 0.25, output: 1.25 },
  },
  openai: {
    'gpt-4o': { input: 2.5, output: 10 },
    'gpt-4o-2024-11-20': { input: 2.5, output: 10 },
    'gpt-4o-mini': { input: 0.15, output: 0.6 },
    'gpt-4o-mini-2024-07-18': { input: 0.15, output: 0.6 },
    'gpt-4-turbo': { input: 10, output: 30 },
    'gpt-4': { input: 30, output: 60 },
    'gpt-5': { input: 5, output: 20 },
    'gpt-5-mini': { input: 0.5, output: 2 },
  },
  moonshot: {
    'kimi-k2': { input: 0.6, output: 2.4 },
    'k2.5': { input: 0.6, output: 2.4 },
    k2p5: { input: 0.6, output: 2.4 },
    'k2-mini': { input: 0.15, output: 0.6 },
    'moonshot-v1-8k': { input: 0.6, output: 2.4 },
    'moonshot-v1-32k': { input: 1.2, output: 4.8 },
    'moonshot-v1-128k': { input: 2.4, output: 9.6 },
  },
  'kimi-coding': {
    k2p5: { input: 0.6, output: 2.4 },
    'k2.5': { input: 0.6, output: 2.4 },
    'kimi-k2': { input: 0.6, output: 2.4 },
  },
  google: {
    'gemini-3-pro': { input: 1.5, output: 6 },
    'gemini-3-pro-preview': { input: 1.5, output: 6 },
    'gemini-3-flash': { input: 0.15, output: 0.6 },
    'gemini-3-flash-preview': { input: 0.15, output: 0.6 },
    'gemini-2.0-flash': { input: 0.1, output: 0.4 },
    'gemini-1.5-pro': { input: 1.25, output: 5 },
    'gemini-1.5-flash': { input: 0.075, output: 0.3 },
  },
  deepseek: {
    'deepseek-chat': { input: 0.14, output: 0.28 },
    'deepseek-reasoner': { input: 0.55, output: 2.19 },
    'deepseek-v3': { input: 0.27, output: 1.1 },
  },
  openrouter: {},
}

function getLegacyWindowsOpenClawPath(): string {
  return path.join(os.homedir(), 'AppData', 'Roaming', 'openclaw')
}

function getModernWindowsOpenClawPath(): string {
  return path.join(os.homedir(), '.openclaw')
}

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

function isOpenClawRoot(directoryPath: string): boolean {
  if (!fs.existsSync(directoryPath)) {
    return false
  }

  try {
    if (!fs.statSync(directoryPath).isDirectory()) {
      return false
    }
  } catch {
    return false
  }

  return (
    fs.existsSync(path.join(directoryPath, 'openclaw.json')) ||
    fs.existsSync(path.join(directoryPath, 'agents'))
  )
}

export function normalizeOpenClawPath(
  openClawPath?: string | null,
  wsl?: WslOpenClawSettings
): string | undefined {
  const resolvedPath = resolveOpenClawDataPath(openClawPath, wsl)
  if (!resolvedPath) {
    return undefined
  }

  if (resolvedPath.error) {
    return resolvedPath.hostPath
  }

  const cleanedPath = resolvedPath.hostPath
  let currentPath = path.resolve(cleanedPath)

  if (fs.existsSync(currentPath)) {
    try {
      if (!fs.statSync(currentPath).isDirectory()) {
        currentPath = path.dirname(currentPath)
      }
    } catch {
      return path.resolve(cleanedPath)
    }
  }

  let candidate = currentPath
  for (let i = 0; i < 5; i++) {
    if (isOpenClawRoot(candidate)) {
      return candidate
    }

    const parent = path.dirname(candidate)
    if (parent === candidate) {
      break
    }
    candidate = parent
  }

  return currentPath
}

export function getDefaultOpenClawPath(): string {
  const platform = os.platform()
  const home = os.homedir()

  // OpenClaw supports relocating its state directory. Respect that contract
  // on both Windows and Unix instead of silently reading a second default
  // state directory.
  const configuredStatePath = normalizeOpenClawPath(
    process.env.OPENCLAW_STATE_DIR
  )
  if (configuredStatePath) {
    return configuredStatePath
  }

  if (platform === 'darwin') {
    return path.join(home, '.openclaw')
  } else if (platform === 'win32') {
    const candidates = [
      getModernWindowsOpenClawPath(),
      getLegacyWindowsOpenClawPath(),
    ]

    const existingPath = candidates.find((candidate) =>
      isOpenClawRoot(candidate)
    )
    if (existingPath) {
      return existingPath
    }

    const wslPath = detectDefaultWslOpenClawPath()
    if (wslPath) {
      return wslPath.hostPath
    }

    return candidates[0]
  } else {
    // Linux and others
    return path.join(home, '.openclaw')
  }
}

function resolveConfiguredOpenClawPath(
  configuredPath: string | undefined,
  detectedDefaultPath: string,
  wsl?: WslOpenClawSettings
): string {
  if (wsl?.enabled) {
    return (
      normalizeOpenClawPath(configuredPath, wsl) ??
      configuredPath ??
      detectedDefaultPath
    )
  }

  if (!configuredPath) {
    return detectedDefaultPath
  }

  if (process.platform === 'win32') {
    const legacyWindowsPath = path.resolve(getLegacyWindowsOpenClawPath())
    const modernWindowsPath = path.resolve(getModernWindowsOpenClawPath())
    const normalizedConfiguredPath = path.resolve(configuredPath)

    if (
      normalizedConfiguredPath === legacyWindowsPath &&
      !isOpenClawRoot(legacyWindowsPath) &&
      isOpenClawRoot(modernWindowsPath)
    ) {
      return modernWindowsPath
    }
  }

  return configuredPath
}

export function normalizeWslConfig(
  wsl?: Partial<Config['wsl']>
): Config['wsl'] {
  return {
    enabled: Boolean(wsl?.enabled ?? DEFAULT_CONFIG.wsl.enabled),
    distro:
      typeof wsl?.distro === 'string'
        ? stripWrappingQuotes(wsl.distro)
        : DEFAULT_CONFIG.wsl.distro,
    openClawPath:
      typeof wsl?.openClawPath === 'string' &&
      stripWrappingQuotes(wsl.openClawPath)
        ? stripWrappingQuotes(wsl.openClawPath)
        : DEFAULT_WSL_OPENCLAW_PATH,
  }
}

function normalizeDataSourceEnvironment(
  value: unknown,
  fallback: DataSourceEnvironment
): DataSourceEnvironment {
  return value === 'wsl' || value === 'local' ? value : fallback
}

export function normalizeHermesPath(
  value: string | null | undefined,
  environment: DataSourceEnvironment,
  distro?: string
): string | undefined {
  // A \\wsl.localhost\\... or \\wsl$\\... path is already resolved; feeding it
  // through the Linux resolver would prepend a second WSL UNC prefix.
  const rawValue = value?.trim()
  if (rawValue && isWslUncPath(rawValue)) {
    return rawValue
  }

  const resolved = resolveDataSourcePath(value, environment, distro)
  if (!resolved) return undefined

  // The resolver may return a \\wsl$\\... host path. Re-resolving that Windows
  // path later would treat it as a Linux path and prepend a second WSL prefix.
  let normalized = isWslUncPath(resolved.hostPath)
    ? resolved.originalPath || resolved.hostPath
    : resolved.hostPath
  try {
    if (fs.existsSync(normalized) && fs.statSync(normalized).isFile()) {
      normalized = path.dirname(normalized)
    }
  } catch {
    // Validation reports inaccessible or malformed paths with source context.
  }
  return normalized
}

export function normalizeDataSourcesConfig(
  sources: Partial<Config['dataSources']> | undefined,
  legacyOpenClawPath: string | undefined,
  wsl: Config['wsl'],
  defaultOpenClawPath = getDefaultOpenClawPath()
): Config['dataSources'] {
  const legacyEnvironment: DataSourceEnvironment =
    wsl.enabled ||
    Boolean(legacyOpenClawPath && isWslUncPath(legacyOpenClawPath))
      ? 'wsl'
      : 'local'
  const openclawEnvironment = normalizeDataSourceEnvironment(
    sources?.openclaw?.environment,
    legacyEnvironment
  )
  const openclawRequestedPath =
    sources?.openclaw?.path || legacyOpenClawPath || defaultOpenClawPath
  const openclawWsl: WslOpenClawSettings = {
    ...wsl,
    enabled: openclawEnvironment === 'wsl',
    openClawPath: openclawRequestedPath,
  }
  const openclawPath = resolveConfiguredOpenClawPath(
    normalizeOpenClawPath(openclawRequestedPath, openclawWsl),
    defaultOpenClawPath,
    openclawWsl
  )

  const hermesEnvironment = normalizeDataSourceEnvironment(
    sources?.hermes?.environment,
    'local'
  )
  const hermesRequestedPath = sources?.hermes?.path || ''
  const hermesPath = hermesRequestedPath
    ? normalizeHermesPath(hermesRequestedPath, hermesEnvironment, wsl.distro) ||
      hermesRequestedPath
    : ''

  return {
    openclaw: {
      enabled: sources?.openclaw?.enabled ?? true,
      environment: openclawEnvironment,
      path: openclawPath,
    },
    hermes: {
      enabled: sources?.hermes?.enabled ?? false,
      environment: hermesEnvironment,
      path: hermesPath,
    },
  }
}

export function getDefaultGatewayLogsPath(): string {
  const platform = os.platform()

  if (platform === 'win32') {
    return path.join(os.tmpdir(), 'openclaw')
  } else {
    return '/tmp/openclaw'
  }
}

function deepMerge<T extends object>(target: T, source: Partial<T>): T {
  const result = { ...target }
  for (const key in source) {
    if (source[key] !== undefined) {
      if (
        typeof source[key] === 'object' &&
        source[key] !== null &&
        !Array.isArray(source[key]) &&
        typeof target[key] === 'object' &&
        target[key] !== null
      ) {
        result[key] = deepMerge(
          target[key] as object,
          source[key] as object
        ) as T[Extract<keyof T, string>]
      } else {
        result[key] = source[key] as T[Extract<keyof T, string>]
      }
    }
  }
  return result
}

function ratesEqual(
  left:
    | { input: number; output: number; cacheRead?: number; cacheWrite?: number }
    | undefined,
  right:
    | { input: number; output: number; cacheRead?: number; cacheWrite?: number }
    | undefined
): boolean {
  if (!left || !right) {
    return false
  }

  return (
    left.input === right.input &&
    left.output === right.output &&
    left.cacheRead === right.cacheRead &&
    left.cacheWrite === right.cacheWrite
  )
}

function looksLikeLegacyUsdRates(rates?: Partial<DefaultRates>): boolean {
  if (!rates || typeof rates !== 'object') {
    return false
  }

  let matches = 0

  for (const [provider, providerRates] of Object.entries(rates)) {
    if (!providerRates || typeof providerRates !== 'object') {
      continue
    }

    for (const [model, rate] of Object.entries(providerRates)) {
      if (ratesEqual(rate, LEGACY_DEFAULT_RATES[provider]?.[model])) {
        matches++
      }
    }
  }

  return matches >= 5
}

function stripLegacyDefaultOverrides(
  rates: Partial<DefaultRates>
): Partial<DefaultRates> {
  const result: Partial<DefaultRates> = {}

  for (const [provider, providerRates] of Object.entries(rates)) {
    if (!providerRates || typeof providerRates !== 'object') {
      continue
    }

    const keptEntries = Object.entries(providerRates).filter(
      ([model, rate]) =>
        !ratesEqual(rate, LEGACY_DEFAULT_RATES[provider]?.[model])
    )

    if (keptEntries.length > 0) {
      result[provider] = Object.fromEntries(keptEntries)
    }
  }

  return result
}

function convertRatesToCny(
  rates: Partial<DefaultRates>
): Partial<DefaultRates> {
  return Object.fromEntries(
    Object.entries(rates).map(([provider, providerRates]) => [
      provider,
      Object.fromEntries(
        Object.entries(providerRates ?? {}).map(([model, rate]) => [
          model,
          {
            input: convertUsdToCny(rate.input),
            output: convertUsdToCny(rate.output),
            ...(rate.cacheRead !== undefined
              ? { cacheRead: convertUsdToCny(rate.cacheRead) }
              : {}),
            ...(rate.cacheWrite !== undefined
              ? { cacheWrite: convertUsdToCny(rate.cacheWrite) }
              : {}),
          },
        ])
      ),
    ])
  )
}

function convertThresholdsToCny(
  thresholds?: Partial<Config['alertThresholds']>
): Partial<Config['alertThresholds']> {
  if (!thresholds) {
    return {}
  }

  return {
    ...(thresholds.dailyBudget !== undefined
      ? { dailyBudget: convertUsdToCny(thresholds.dailyBudget) }
      : {}),
    ...(thresholds.weeklyBudget !== undefined
      ? { weeklyBudget: convertUsdToCny(thresholds.weeklyBudget) }
      : {}),
    ...(thresholds.monthlyBudget !== undefined
      ? { monthlyBudget: convertUsdToCny(thresholds.monthlyBudget) }
      : {}),
  }
}

export function ensureConfigDir(): void {
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true })
  }
}

interface CachedConfig {
  mtimeMs: number
  size: number
  config: Config
}

let cachedConfig: CachedConfig | null = null

export function loadConfig(): Config {
  ensureConfigDir()

  let stat: fs.Stats | null = null
  try {
    stat = fs.statSync(CONFIG_FILE)
  } catch {
    // File missing or unreadable; fall through to the uncached path which
    // will create the default file on first run.
  }

  if (
    stat &&
    cachedConfig &&
    cachedConfig.mtimeMs === stat.mtimeMs &&
    cachedConfig.size === stat.size
  ) {
    return cachedConfig.config
  }

  const config = loadConfigFromDisk()
  if (stat) {
    cachedConfig = { mtimeMs: stat.mtimeMs, size: stat.size, config }
  }
  return config
}

export function invalidateConfigCache(): void {
  cachedConfig = null
}

function loadConfigFromDisk(): Config {
  const defaultWsl = normalizeWslConfig(DEFAULT_CONFIG.wsl)
  const defaultOpenClawPath = getDefaultOpenClawPath()
  const defaultConfig: Config = {
    ...DEFAULT_CONFIG,
    wsl: defaultWsl,
    dataSources: normalizeDataSourcesConfig(
      undefined,
      defaultOpenClawPath,
      defaultWsl,
      defaultOpenClawPath
    ),
    openClawPath: defaultOpenClawPath,
    gatewayLogsPath: getDefaultGatewayLogsPath(),
  }

  if (!fs.existsSync(CONFIG_FILE)) {
    // Create default config file
    saveConfig(defaultConfig)
    cachedConfig = {
      mtimeMs: getConfigMtimeOrZero(),
      size: getConfigSizeOrZero(),
      config: defaultConfig,
    }
    return defaultConfig
  }

  try {
    const fileContent = fs.readFileSync(CONFIG_FILE, 'utf-8')
    const userConfig = yaml.parse(fileContent) as Partial<Config>
    let wslConfig = normalizeWslConfig(userConfig.wsl)
    const dataSources = normalizeDataSourcesConfig(
      userConfig.dataSources,
      userConfig.openClawPath,
      wslConfig,
      defaultOpenClawPath
    )
    const configuredWslPath =
      parseWslUncPath(dataSources.openclaw.path) ??
      parseWslUncPath(dataSources.hermes.path)
    const correctedWslDistro = Boolean(
      configuredWslPath && configuredWslPath.distro !== wslConfig.distro
    )
    if (configuredWslPath) {
      wslConfig = { ...wslConfig, distro: configuredWslPath.distro }
    }
    const hasLegacyUsdRates = looksLikeLegacyUsdRates(userConfig.rates)
    // Threshold values such as 10/50/200 are valid user-configured CNY
    // budgets and are not sufficient evidence of a legacy USD file.
    const shouldConvertLegacyCurrency =
      userConfig.schemaVersion === undefined && hasLegacyUsdRates

    const normalizedUserRates = shouldConvertLegacyCurrency
      ? convertRatesToCny(stripLegacyDefaultOverrides(userConfig.rates || {}))
      : userConfig.rates || {}

    // Merge user config with defaults (so new models are available)
    const mergedRates: DefaultRates = deepMerge(
      DEFAULT_RATES,
      normalizedUserRates
    )

    const config: Config = {
      schemaVersion: 3,
      currency: 'CNY',
      dataSources,
      rates: mergedRates,
      alertThresholds: {
        ...defaultConfig.alertThresholds,
        ...(shouldConvertLegacyCurrency
          ? convertThresholdsToCny(userConfig.alertThresholds)
          : userConfig.alertThresholds),
      },
      // OpenClaw settings
      openClawPath: dataSources.openclaw.path,
      gatewayLogsPath:
        userConfig.gatewayLogsPath || defaultConfig.gatewayLogsPath,
      wsl: {
        ...wslConfig,
        enabled: dataSources.openclaw.environment === 'wsl',
        openClawPath: dataSources.openclaw.path,
      },
      securityAlertsEnabled:
        userConfig.securityAlertsEnabled ?? defaultConfig.securityAlertsEnabled,
      // Pricing
      pricingEndpoint:
        userConfig.pricingEndpoint ?? defaultConfig.pricingEndpoint,
    }

    if (
      shouldConvertLegacyCurrency ||
      userConfig.schemaVersion !== 3 ||
      !userConfig.dataSources ||
      correctedWslDistro
    ) {
      try {
        saveConfig(config)
      } catch (saveError) {
        console.warn(
          'Failed to persist migrated config, using migrated config in memory:',
          saveError
        )
      }
    }

    return config
  } catch (error) {
    console.error('Error loading config, using defaults:', error)
    return defaultConfig
  }
}

function getConfigMtimeOrZero(): number {
  try {
    return fs.statSync(CONFIG_FILE).mtimeMs
  } catch {
    return 0
  }
}

function getConfigSizeOrZero(): number {
  try {
    return fs.statSync(CONFIG_FILE).size
  } catch {
    return 0
  }
}

export function saveConfig(config: Config): void {
  ensureConfigDir()
  const yamlContent = yaml.stringify(config, { indent: 2 })
  fs.writeFileSync(CONFIG_FILE, yamlContent, 'utf-8')
  cachedConfig = null
}

export function getConfigPath(): string {
  return CONFIG_FILE
}

export function getConfigDir(): string {
  return CONFIG_DIR
}
