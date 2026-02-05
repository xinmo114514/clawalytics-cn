export interface ProviderRates {
  [model: string]: {
    input: number;  // cost per 1M input tokens
    output: number; // cost per 1M output tokens
  };
}

// Cache pricing multipliers (relative to input rate)
// These are standard across most providers
export const CACHE_RATE_MULTIPLIERS = {
  write: 1.25,  // Cache creation (cache_creation_input_tokens): 1.25x input price
  read: 0.1,    // Cache read (cache_read_input_tokens): 0.1x input price (90% discount!)
} as const;

export interface DefaultRates {
  [provider: string]: ProviderRates;
}

export const DEFAULT_RATES: DefaultRates = {
  anthropic: {
    'claude-opus-4': { input: 15, output: 75 },
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
  },
  kimi: {
    'k2.5': { input: 0.6, output: 2.4 },
    'moonshot-v1-8k': { input: 0.6, output: 2.4 },
    'moonshot-v1-32k': { input: 1.2, output: 4.8 },
    'moonshot-v1-128k': { input: 2.4, output: 9.6 },
  },
  google: {
    'gemini-2.0-flash': { input: 0.1, output: 0.4 },
    'gemini-1.5-pro': { input: 1.25, output: 5 },
    'gemini-1.5-flash': { input: 0.075, output: 0.3 },
  },
  deepseek: {
    'deepseek-chat': { input: 0.14, output: 0.28 },
    'deepseek-reasoner': { input: 0.55, output: 2.19 },
  },
};

export interface Config {
  logPath: string;
  rates: DefaultRates;
  alertThresholds: {
    dailyBudget: number;
    weeklyBudget: number;
    monthlyBudget: number;
  };
}

export const DEFAULT_CONFIG: Config = {
  logPath: '',  // Will be auto-detected based on OS
  rates: DEFAULT_RATES,
  alertThresholds: {
    dailyBudget: 10,
    weeklyBudget: 50,
    monthlyBudget: 200,
  },
};
