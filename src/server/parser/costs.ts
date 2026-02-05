import { loadConfig } from '../config/loader.js';
import type { Config } from '../config/loader.js';

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  cacheCreationTokens?: number;
  cacheReadTokens?: number;
}

export interface CostResult {
  inputCost: number;
  outputCost: number;
  cacheCreationCost: number;
  cacheReadCost: number;
  totalCost: number;
  cacheSavings: number;  // How much saved vs paying full input price
  inputTokens: number;
  outputTokens: number;
  cacheCreationTokens: number;
  cacheReadTokens: number;
}

// Cache pricing multipliers (relative to input rate)
export const CACHE_WRITE_MULTIPLIER = 1.25;  // Cache creation costs 1.25x input price
export const CACHE_READ_MULTIPLIER = 0.1;    // Cache read costs 0.1x input price (90% discount)

export function calculateCost(
  provider: string,
  model: string,
  usage: TokenUsage,
  config?: Config
): CostResult {
  const cfg = config || loadConfig();
  const providerRates = cfg.rates[provider.toLowerCase()];

  // Try exact model match first
  let rates = providerRates?.[model];

  // If not found, try matching by model family/prefix
  if (!rates && providerRates) {
    const modelLower = model.toLowerCase();
    for (const [rateModel, rateValue] of Object.entries(providerRates)) {
      if (modelLower.includes(rateModel.toLowerCase()) || rateModel.toLowerCase().includes(modelLower.split('-')[0])) {
        rates = rateValue;
        break;
      }
    }
  }

  // Default to zero if no rates found
  if (!rates) {
    console.warn(`No rates found for ${provider}/${model}, using zero cost`);
    rates = { input: 0, output: 0 };
  }

  // Extract token counts with defaults for backward compatibility
  const inputTokens = usage.inputTokens;
  const outputTokens = usage.outputTokens;
  const cacheCreationTokens = usage.cacheCreationTokens ?? 0;
  const cacheReadTokens = usage.cacheReadTokens ?? 0;

  // Calculate costs (rates are per 1M tokens)
  const inputCost = (inputTokens / 1_000_000) * rates.input;
  const outputCost = (outputTokens / 1_000_000) * rates.output;

  // Cache costs based on input rate with multipliers
  const cacheCreationCost = (cacheCreationTokens / 1_000_000) * rates.input * CACHE_WRITE_MULTIPLIER;
  const cacheReadCost = (cacheReadTokens / 1_000_000) * rates.input * CACHE_READ_MULTIPLIER;

  // Calculate savings: what user would have paid at full input rate minus actual cache costs
  const fullPriceForCacheTokens = ((cacheCreationTokens + cacheReadTokens) / 1_000_000) * rates.input;
  const actualCacheCost = cacheCreationCost + cacheReadCost;
  const cacheSavings = fullPriceForCacheTokens - actualCacheCost;

  return {
    inputCost,
    outputCost,
    cacheCreationCost,
    cacheReadCost,
    totalCost: inputCost + outputCost + cacheCreationCost + cacheReadCost,
    cacheSavings,
    inputTokens,
    outputTokens,
    cacheCreationTokens,
    cacheReadTokens,
  };
}

export function identifyProvider(model: string): string {
  const modelLower = model.toLowerCase();

  if (modelLower.includes('claude') || modelLower.includes('anthropic')) {
    return 'anthropic';
  }
  if (modelLower.includes('gpt') || modelLower.includes('o1') || modelLower.includes('davinci') || modelLower.includes('curie')) {
    return 'openai';
  }
  if (modelLower.includes('moonshot') || modelLower.includes('kimi') || modelLower.includes('k2.')) {
    return 'kimi';
  }
  if (modelLower.includes('gemini')) {
    return 'google';
  }
  if (modelLower.includes('deepseek')) {
    return 'deepseek';
  }

  return 'unknown';
}
