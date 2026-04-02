import fs from 'fs';
import path from 'path';
import os from 'os';
import yaml from 'yaml';
import { DEFAULT_CONFIG, DEFAULT_RATES, type Config, type DefaultRates } from './defaults.js';

// Re-export types for use in other modules
export type { Config, DefaultRates, ProviderRates } from './defaults.js';

const CONFIG_DIR = path.join(os.homedir(), '.clawalytics');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.yaml');

function getLegacyWindowsOpenClawPath(): string {
  return path.join(os.homedir(), 'AppData', 'Roaming', 'openclaw');
}

function getModernWindowsOpenClawPath(): string {
  return path.join(os.homedir(), '.openclaw');
}

function stripWrappingQuotes(value: string): string {
  const trimmed = value.trim();
  if (
    trimmed.length >= 2 &&
    ((trimmed.startsWith('"') && trimmed.endsWith('"'))
      || (trimmed.startsWith("'") && trimmed.endsWith("'")))
  ) {
    return trimmed.slice(1, -1).trim();
  }
  return trimmed;
}

function expandHomeDirectory(value: string): string {
  if (value === '~') {
    return os.homedir();
  }

  if (value.startsWith('~/') || value.startsWith('~\\')) {
    return path.join(os.homedir(), value.slice(2));
  }

  return value;
}

function isOpenClawRoot(directoryPath: string): boolean {
  if (!fs.existsSync(directoryPath)) {
    return false;
  }

  try {
    if (!fs.statSync(directoryPath).isDirectory()) {
      return false;
    }
  } catch {
    return false;
  }

  return (
    fs.existsSync(path.join(directoryPath, 'openclaw.json'))
    || fs.existsSync(path.join(directoryPath, 'agents'))
  );
}

export function normalizeOpenClawPath(openClawPath?: string | null): string | undefined {
  if (typeof openClawPath !== 'string') {
    return undefined;
  }

  const cleanedPath = expandHomeDirectory(stripWrappingQuotes(openClawPath));
  if (!cleanedPath) {
    return undefined;
  }

  let currentPath = path.resolve(cleanedPath);

  if (fs.existsSync(currentPath)) {
    try {
      if (!fs.statSync(currentPath).isDirectory()) {
        currentPath = path.dirname(currentPath);
      }
    } catch {
      return path.resolve(cleanedPath);
    }
  }

  let candidate = currentPath;
  for (let i = 0; i < 5; i++) {
    if (isOpenClawRoot(candidate)) {
      return candidate;
    }

    const parent = path.dirname(candidate);
    if (parent === candidate) {
      break;
    }
    candidate = parent;
  }

  return currentPath;
}

export function getDefaultOpenClawPath(): string {
  const platform = os.platform();
  const home = os.homedir();

  if (platform === 'darwin') {
    return path.join(home, '.openclaw');
  } else if (platform === 'win32') {
    const candidates = [
      getModernWindowsOpenClawPath(),
      getLegacyWindowsOpenClawPath(),
    ];

    const existingPath = candidates.find((candidate) => fs.existsSync(candidate));
    return existingPath ?? candidates[0];
  } else {
    // Linux and others
    return path.join(home, '.openclaw');
  }
}

function resolveConfiguredOpenClawPath(
  configuredPath: string | undefined,
  detectedDefaultPath: string
): string {
  if (!configuredPath) {
    return detectedDefaultPath;
  }

  if (process.platform === 'win32') {
    const legacyWindowsPath = path.resolve(getLegacyWindowsOpenClawPath());
    const modernWindowsPath = path.resolve(getModernWindowsOpenClawPath());
    const normalizedConfiguredPath = path.resolve(configuredPath);

    if (
      normalizedConfiguredPath === legacyWindowsPath
      && !fs.existsSync(legacyWindowsPath)
      && fs.existsSync(modernWindowsPath)
    ) {
      return modernWindowsPath;
    }
  }

  return configuredPath;
}

export function getDefaultGatewayLogsPath(): string {
  const platform = os.platform();

  if (platform === 'win32') {
    return path.join(os.tmpdir(), 'openclaw');
  } else {
    return '/tmp/openclaw';
  }
}

function deepMerge<T extends object>(target: T, source: Partial<T>): T {
  const result = { ...target };
  for (const key in source) {
    if (source[key] !== undefined) {
      if (
        typeof source[key] === 'object' &&
        source[key] !== null &&
        !Array.isArray(source[key]) &&
        typeof target[key] === 'object' &&
        target[key] !== null
      ) {
        result[key] = deepMerge(target[key] as object, source[key] as object) as T[Extract<keyof T, string>];
      } else {
        result[key] = source[key] as T[Extract<keyof T, string>];
      }
    }
  }
  return result;
}

export function ensureConfigDir(): void {
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
  }
}

export function loadConfig(): Config {
  ensureConfigDir();

  const defaultConfig: Config = {
    ...DEFAULT_CONFIG,
    openClawPath: getDefaultOpenClawPath(),
    gatewayLogsPath: getDefaultGatewayLogsPath(),
  };

  if (!fs.existsSync(CONFIG_FILE)) {
    // Create default config file
    saveConfig(defaultConfig);
    return defaultConfig;
  }

  try {
    const fileContent = fs.readFileSync(CONFIG_FILE, 'utf-8');
    const userConfig = yaml.parse(fileContent) as Partial<Config>;
    const defaultOpenClawPath = getDefaultOpenClawPath();
    const normalizedUserOpenClawPath = normalizeOpenClawPath(userConfig.openClawPath);

    // Merge user config with defaults (so new models are available)
    const mergedRates: DefaultRates = deepMerge(DEFAULT_RATES, userConfig.rates || {});

    return {
      rates: mergedRates,
      alertThresholds: {
        ...defaultConfig.alertThresholds,
        ...userConfig.alertThresholds,
      },
      // OpenClaw settings
      openClawPath: resolveConfiguredOpenClawPath(
        normalizedUserOpenClawPath,
        defaultOpenClawPath
      ),
      gatewayLogsPath: userConfig.gatewayLogsPath || defaultConfig.gatewayLogsPath,
      securityAlertsEnabled: userConfig.securityAlertsEnabled ?? defaultConfig.securityAlertsEnabled,
      // Pricing
      pricingEndpoint: userConfig.pricingEndpoint ?? defaultConfig.pricingEndpoint,
    };
  } catch (error) {
    console.error('Error loading config, using defaults:', error);
    return defaultConfig;
  }
}

export function saveConfig(config: Config): void {
  ensureConfigDir();
  const yamlContent = yaml.stringify(config, { indent: 2 });
  fs.writeFileSync(CONFIG_FILE, yamlContent, 'utf-8');
}

export function getConfigPath(): string {
  return CONFIG_FILE;
}

export function getConfigDir(): string {
  return CONFIG_DIR;
}
