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
  'MiniMax-M3': {
    input: 2.1,
    output: 8.4,
    cacheRead: 0.42,
    cacheWrite: 2.625,
  },
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
  'MiniMax-M2.1': {
    input: 2.1,
    output: 8.4,
    cacheRead: 0.21,
    cacheWrite: 2.625,
  },
  'MiniMax-M2.1-highspeed': {
    input: 4.2,
    output: 16.8,
    cacheRead: 0.21,
    cacheWrite: 2.625,
  },
  'MiniMax-M2': {
    input: 2.1,
    output: 8.4,
    cacheRead: 0.21,
    cacheWrite: 2.625,
  },
}

// Source: https://mimo.mi.com/docs/zh-CN/price/pay-as-you-go (updated 2026-08-06)
// cacheWrite is 0 because MiMo bills cache writes as free for a limited time;
// it must be stated explicitly or the `input * 1.25` fallback would overcharge.
const XIAOMI_PAYG_RATES: ProviderRates = {
  'mimo-v2.5': {
    input: 1,
    output: 2,
    cacheRead: 0.02,
    cacheWrite: 0,
  },
  'mimo-v2.5-pro': {
    input: 3,
    output: 6,
    cacheRead: 0.025,
    cacheWrite: 0,
  },
}

const KIMI_PAYG_RATES: ProviderRates = {
  'kimi-k3': { input: 20, output: 100, cacheRead: 2 },
  'kimi-k2.7-code': { input: 6.5, output: 27, cacheRead: 1.3 },
  'kimi-k2.7-code-highspeed': { input: 6.5, output: 27, cacheRead: 1.3 },
  'kimi-k2.6': { input: 6.5, output: 27, cacheRead: 1.1 },
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
  // Legacy aliases routed to V4-Flash before their July 2026 retirement.
  'deepseek-chat': {
    input: 3,
    output: 9,
    cacheRead: 0.1,
    cacheWrite: 3,
  },
  'deepseek-reasoner': {
    input: 3,
    output: 9,
    cacheRead: 0.1,
    cacheWrite: 3,
  },
  'deepseek-v3': { input: 1.96, output: 2.94, cacheRead: 0.196 },
  // DeepSeek V4 peak-hour prices (CNY per 1M tokens). Peak hours are
  // weekdays 09:00-12:00 and 14:00-18:00 Beijing time; off-peak is half.
  // Cache writes use the cache-miss/input rate because DeepSeek bills them
  // as uncached input tokens.
  'deepseek-v4-flash': {
    input: 3,
    output: 9,
    cacheRead: 0.1,
    cacheWrite: 3,
  },
  'deepseek-v4-pro': {
    input: 9,
    output: 27,
    cacheRead: 0.3,
    cacheWrite: 9,
  },
  'deepseek-v4-flash-vision-exp': {
    input: 3,
    output: 9,
    cacheRead: 0.1,
    cacheWrite: 3,
  },
}

const QWEN_PAYG_RATES: ProviderRates = {
  // Current Qwen coding aliases; prices are the commonly used short-context
  // tier from Alibaba Cloud Model Studio's official pricing table.
  'qwen3-coder-next': { input: 2.1, output: 10.5 },
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
  'glm-5.2': { input: 8, output: 28, cacheRead: 2 },
  'glm-5.1': { input: 6, output: 24, cacheRead: 1.3 },
  'glm-5-turbo': { input: 5, output: 22, cacheRead: 1.2 },
  'glm-5': { input: 4, output: 18, cacheRead: 1 },
  'glm-4.7': { input: 2, output: 8, cacheRead: 0.4 },
  'glm-4.7-flashx': { input: 0.5, output: 3, cacheRead: 0.1 },
  'glm-4.5': { input: 0.8, output: 2 },
  // The official GLM-4.5 docs list this as the low-end price for the 4.5 series.
  'glm-4.5-air': { input: 0.8, output: 2 },
  'glm-4.5-flash': { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
  'glm-4.7-flash': { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
}

const TENCENT_PAYG_RATES: ProviderRates = {
  hunyuan: { input: 0.5, output: 2 },
  'hunyuan-a13b': { input: 0.5, output: 2 },
  'hunyuan-role-latest': { input: 2.4, output: 9.6 },
  'hunyuan-translation': { input: 1.2, output: 3.6 },
  'hunyuan-translation-lite': { input: 1, output: 3 },
  'hunyuan-t1-vision': { input: 3, output: 9 },
  'hunyuan-turbos-vision': { input: 3, output: 9 },
  'hunyuan-turbos-vision-video': { input: 3, output: 9 },
  'tencent-hy-vision-1.5-instruct': { input: 3, output: 9 },
  'hunyuan-embedding': { input: 0.7, output: 0.7 },
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
    // GPT-5.6 prices from the official OpenAI API pricing page, converted
    // from USD to CNY using the app's fixed USD_TO_CNY_RATE (7).
    // gpt-5.6 is the official alias for GPT-5.6 Sol.
    'gpt-5.6': {
      input: 28,
      output: 140,
      cacheRead: 2.8,
      cacheWrite: 35,
    },
    'gpt-5.6-sol': {
      input: 28,
      output: 140,
      cacheRead: 2.8,
      cacheWrite: 35,
    },
    'gpt-5.6-terra': {
      input: 14,
      output: 84,
      cacheRead: 1.4,
      cacheWrite: 17.5,
    },
    'gpt-5.6-luna': {
      input: 1.4,
      output: 8.4,
      cacheRead: 0.14,
      cacheWrite: 1.75,
    },
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
  tencent: cloneProviderRates(TENCENT_PAYG_RATES),
  hunyuan: cloneProviderRates(TENCENT_PAYG_RATES),
  xiaomi: cloneProviderRates(XIAOMI_PAYG_RATES),
  // OpenClaw's qwen-portal provider currently uses an OAuth/free-tier path
  // rather than a direct paid token-billed API.
  'qwen-portal': {
    'coder-model': { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
  },
  // OpenRouter acts as a gateway - models use their native provider pricing
  openrouter: {},
}

export interface Config {
  /** Versioned currency marker used to make legacy migrations unambiguous. */
  schemaVersion?: number
  currency?: 'CNY'
  dataSources: {
    openclaw: DataSourceConfig
    hermes: DataSourceConfig
  }
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

export type DataSourceEnvironment = 'local' | 'wsl'

export interface DataSourceConfig {
  enabled: boolean
  environment: DataSourceEnvironment
  path: string
}

export const DEFAULT_CONFIG: Config = {
  schemaVersion: 3,
  currency: 'CNY',
  dataSources: {
    openclaw: {
      enabled: true,
      environment: 'local',
      path: '',
    },
    hermes: {
      enabled: false,
      environment: 'local',
      path: '',
    },
  },
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
