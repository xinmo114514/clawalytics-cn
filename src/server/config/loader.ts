import fs from 'fs';
import path from 'path';
import os from 'os';
import yaml from 'yaml';
import { DEFAULT_CONFIG, DEFAULT_RATES, type Config, type DefaultRates } from './defaults.js';

// Re-export types for use in other modules
export type { Config, DefaultRates, ProviderRates } from './defaults.js';

const CONFIG_DIR = path.join(os.homedir(), '.clawalytics');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.yaml');

function getDefaultLogPath(): string {
  const platform = os.platform();
  const home = os.homedir();

  if (platform === 'darwin') {
    return path.join(home, '.claude', 'projects');
  } else if (platform === 'win32') {
    return path.join(home, 'AppData', 'Roaming', 'claude', 'projects');
  } else {
    // Linux and others
    return path.join(home, '.claude', 'projects');
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
    logPath: getDefaultLogPath(),
  };

  if (!fs.existsSync(CONFIG_FILE)) {
    // Create default config file
    saveConfig(defaultConfig);
    return defaultConfig;
  }

  try {
    const fileContent = fs.readFileSync(CONFIG_FILE, 'utf-8');
    const userConfig = yaml.parse(fileContent) as Partial<Config>;

    // Merge user config with defaults (so new models are available)
    const mergedRates: DefaultRates = deepMerge(DEFAULT_RATES, userConfig.rates || {});

    return {
      logPath: userConfig.logPath || defaultConfig.logPath,
      rates: mergedRates,
      alertThresholds: {
        ...defaultConfig.alertThresholds,
        ...userConfig.alertThresholds,
      },
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
