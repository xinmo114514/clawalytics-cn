export interface ProviderRates {
  [model: string]: {
    input: number // cost per 1M input tokens (CNY)
    output: number // cost per 1M output tokens (CNY)
    cacheRead?: number // cost per 1M cache read tokens (CNY)
    cacheWrite?: number // cost per 1M cache write tokens (CNY)
  }
}

// Cache pricing multipliers (relative to input rate)
// These are standard across most providers
export const CACHE_RATE_MULTIPLIERS = {
  write: 1.25, // Cache creation (cache_creation_input_tokens): 1.25x input price
  read: 0.1, // Cache read (cache_read_input_tokens): 0.1x input price (90% discount!)
} as const

export interface DefaultRates {
  [provider: string]: ProviderRates
}

function cloneProviderRates(rates: ProviderRates): ProviderRates {
  return Object.fromEntries(
    Object.entries(rates).map(([model, rate]) => [model, { ...rate }])
  )
}

const MINIMAX_PAYG_RATES: ProviderRates = {
  'MiniMax-M2.7': {
    input: 2.1,
    output: 8.4,
    cacheRead: 0.42,
    cacheWrite: 2.625,
  },
  'MiniMax-M2.7-highspeed': {
    input: 4.2,
    output: 16.8,
    cacheRead: 0.42,
    cacheWrite: 2.625,
  },
  'MiniMax-M2.5': {
    input: 2.1,
    output: 8.4,
    cacheRead: 0.21,
    cacheWrite: 2.625,
  },
  'MiniMax-M2.5-highspeed': {
    input: 4.2,
    output: 16.8,
    cacheRead: 0.21,
    cacheWrite: 2.625,
  },
}

const KIMI_PAYG_RATES: ProviderRates = {
  'kimi-k2.5': { input: 4, output: 21, cacheRead: 0.7 },
  'k2.5': { input: 4, output: 21, cacheRead: 0.7 },
  k2p5: { input: 4, output: 21, cacheRead: 0.7 },
  'kimi-k2': { input: 4, output: 16, cacheRead: 1 },
  'kimi-k2-0711-preview': { input: 4, output: 16, cacheRead: 1 },
  'kimi-k2-0905-preview': { input: 4, output: 16, cacheRead: 1 },
  k2: { input: 4, output: 16, cacheRead: 1 },
  'kimi-k2-thinking': { input: 4, output: 16, cacheRead: 1 },
  'kimi-k2-thinking-preview': { input: 4, output: 16, cacheRead: 1 },
  'k2-mini': { input: 1.05, output: 4.2 },
  'moonshot-v1-8k': { input: 4.2, output: 16.8 },
  'moonshot-v1-32k': { input: 8.4, output: 33.6 },
  'moonshot-v1-128k': { input: 16.8, output: 67.2 },
}

const DEEPSEEK_PAYG_RATES: ProviderRates = {
  'deepseek-chat': { input: 1.96, output: 2.94, cacheRead: 0.196 },
  'deepseek-reasoner': { input: 1.96, output: 2.94, cacheRead: 0.196 },
  'deepseek-v3': { input: 1.96, output: 2.94, cacheRead: 0.196 },
  // DeepSeek V4 models
  'deepseek-v4-flash': { input: 1, output: 2, cacheRead: 0.2 },
  'deepseek-v4-pro': { input: 12, output: 24, cacheRead: 1 },
}

const QWEN_PAYG_RATES: ProviderRates = {
  'qwen-max': { input: 2.4, output: 9.6 },
  'qwen-max-latest': { input: 2.4, output: 9.6 },
  'qwen-max-2025-01-25': { input: 2.4, output: 9.6 },
  'qwen-plus': { input: 0.8, output: 2 },
  'qwen-plus-latest': { input: 0.8, output: 2 },
  'qwen-plus-2025-12-01': { input: 0.8, output: 2 },
  'qwen-turbo': { input: 0.3, output: 0.6 },
  'qwen-turbo-latest': { input: 0.3, output: 0.6 },
  'qwen-turbo-2025-07-15': { input: 0.3, output: 0.6 },
  'qwen-coder-plus': { input: 3.5, output: 7 },
  'qwen3-coder-plus': { input: 3.5, output: 7 },
  'qwen-coder-flash': { input: 1, output: 4 },
  'qwen3-coder-flash': { input: 1, output: 4 },
}

const DOUBAO_PAYG_RATES: ProviderRates = {
  'doubao-seed-1.6': { input: 1.6, output: 4 },
  'doubao-seed-1.6-250615': { input: 1.6, output: 4 },
  'doubao-seed-code': { input: 1.2, output: 16, cacheRead: 0.24 },
  'doubao-seed-code-preview-latest': {
    input: 1.2,
    output: 16,
    cacheRead: 0.24,
  },
  'doubao-seed-code-preview-251028': {
    input: 1.2,
    output: 16,
    cacheRead: 0.24,
  },
}

const ZHIPU_PAYG_RATES: ProviderRates = {
  'glm-4.5': { input: 0.8, output: 2 },
  // The official GLM-4.5 docs list this as the low-end price for the 4.5 series.
  'glm-4.5-air': { input: 0.8, output: 2 },
  'glm-4.5-flash': { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
  'glm-4.7-flash': { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
}

// Fallback rates when pricing service is unavailable
// These will be replaced by dynamic pricing from the pricing endpoint
export const DEFAULT_RATES: DefaultRates = {
  anthropic: {
    'claude-opus-4': { input: 105, output: 525 },
    'claude-opus-4-5': { input: 105, output: 525 },
    'claude-opus-4-5-20251101': { input: 105, output: 525 },
    'claude-sonnet-4': { input: 21, output: 105 },
    'claude-sonnet-4-20250514': { input: 21, output: 105 },
    'claude-3-5-sonnet-20241022': { input: 21, output: 105 },
    'claude-haiku': { input: 1.75, output: 8.75 },
    'claude-3-haiku-20240307': { input: 1.75, output: 8.75 },
  },
  openai: {
    'gpt-4o': { input: 17.5, output: 70 },
    'gpt-4o-2024-11-20': { input: 17.5, output: 70 },
    'gpt-4o-mini': { input: 1.05, output: 4.2 },
    'gpt-4o-mini-2024-07-18': { input: 1.05, output: 4.2 },
    'gpt-4-turbo': { input: 70, output: 210 },
    'gpt-4': { input: 210, output: 420 },
    'gpt-5': { input: 35, output: 140 },
    'gpt-5-mini': { input: 3.5, output: 14 },
  },
  moonshot: cloneProviderRates(KIMI_PAYG_RATES),
  // OpenClaw providers (aliases for provider names used by OpenClaw)
  'kimi-coding': cloneProviderRates(KIMI_PAYG_RATES),
  google: {
    'gemini-3-pro': { input: 10.5, output: 42 },
    'gemini-3-pro-preview': { input: 10.5, output: 42 },
    'gemini-3-flash': { input: 1.05, output: 4.2 },
    'gemini-3-flash-preview': { input: 1.05, output: 4.2 },
    'gemini-2.0-flash': { input: 0.7, output: 2.8 },
    'gemini-1.5-pro': { input: 8.75, output: 35 },
    'gemini-1.5-flash': { input: 0.525, output: 2.1 },
  },
  minimax: cloneProviderRates(MINIMAX_PAYG_RATES),
  'minimax-portal': cloneProviderRates(MINIMAX_PAYG_RATES),
  deepseek: cloneProviderRates(DEEPSEEK_PAYG_RATES),
  qwen: cloneProviderRates(QWEN_PAYG_RATES),
  dashscope: cloneProviderRates(QWEN_PAYG_RATES),
  doubao: cloneProviderRates(DOUBAO_PAYG_RATES),
  volcengine: cloneProviderRates(DOUBAO_PAYG_RATES),
  ark: cloneProviderRates(DOUBAO_PAYG_RATES),
  zhipu: cloneProviderRates(ZHIPU_PAYG_RATES),
  bigmodel: cloneProviderRates(ZHIPU_PAYG_RATES),
  // OpenClaw's qwen-portal provider currently uses an OAuth/free-tier path
  // rather than a direct paid token-billed API.
  'qwen-portal': {
    'coder-model': { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
  },
  // OpenRouter acts as a gateway - models use their native provider pricing
  openrouter: {},
}

export interface Config {
  rates: DefaultRates
  alertThresholds: {
    dailyBudget: number
    weeklyBudget: number
    monthlyBudget: number
  }
  // OpenClaw settings
  openClawPath: string // Path to OpenClaw config (~/.openclaw)
  gatewayLogsPath: string // Path to gateway logs (/tmp/openclaw)
  wsl: {
    enabled: boolean // Read OpenClaw data from WSL2 when running on Windows
    distro: string // WSL distribution name, blank uses the default distro
    openClawPath: string // Linux path inside WSL2 (e.g. ~/.openclaw)
  }
  securityAlertsEnabled: boolean
  // Pricing service
  pricingEndpoint: string | null // Custom endpoint for model pricing
}

export const DEFAULT_CONFIG: Config = {
  rates: DEFAULT_RATES,
  alertThresholds: {
    dailyBudget: 70,
    weeklyBudget: 350,
    monthlyBudget: 1400,
  },
  // OpenClaw defaults
  openClawPath: '', // Will be auto-detected based on OS
  gatewayLogsPath: '/tmp/openclaw',
  wsl: {
    enabled: false,
    distro: 'Ubuntu',
    openClawPath: '~/.openclaw',
  },
  securityAlertsEnabled: true,
  // Pricing
  pricingEndpoint: null, // Set to custom endpoint URL if desired
}
