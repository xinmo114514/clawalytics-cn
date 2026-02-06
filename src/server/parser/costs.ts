import { getModelPricing, type ModelPricing } from '../services/pricing-service.js';

const warnedModels = new Set<string>();

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
  usage: TokenUsage
): CostResult {
  // Get pricing from pricing service
  const pricing = getModelPricing(provider, model);

  // Default to zero if no pricing found
  let rates: ModelPricing;
  if (!pricing) {
    const key = `${provider}/${model}`;
    if (!warnedModels.has(key)) {
      warnedModels.add(key);
      console.warn(`No pricing found for ${key}, using zero cost`);
    }
    rates = { input: 0, output: 0 };
  } else {
    rates = pricing;
  }

  // Extract token counts with defaults for backward compatibility
  const inputTokens = usage.inputTokens;
  const outputTokens = usage.outputTokens;
  const cacheCreationTokens = usage.cacheCreationTokens ?? 0;
  const cacheReadTokens = usage.cacheReadTokens ?? 0;

  // Calculate costs (rates are per 1M tokens)
  const inputCost = (inputTokens / 1_000_000) * rates.input;
  const outputCost = (outputTokens / 1_000_000) * rates.output;

  // Cache costs - use specific rates if available, otherwise calculate from input rate
  const cacheReadRate = rates.cacheRead ?? (rates.input * CACHE_READ_MULTIPLIER);
  const cacheWriteRate = rates.cacheWrite ?? (rates.input * CACHE_WRITE_MULTIPLIER);

  const cacheCreationCost = (cacheCreationTokens / 1_000_000) * cacheWriteRate;
  const cacheReadCost = (cacheReadTokens / 1_000_000) * cacheReadRate;

  // Calculate savings: what user would have paid at full input rate minus actual cache costs
  const fullPriceForCacheTokens = ((cacheCreationTokens + cacheReadTokens) / 1_000_000) * rates.input;
  const actualCacheCost = cacheCreationCost + cacheReadCost;
  const cacheSavings = Math.max(0, fullPriceForCacheTokens - actualCacheCost);

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

/**
 * Identify provider from model name (fallback when not explicitly provided)
 */
export function identifyProvider(model: string): string {
  const modelLower = model.toLowerCase();

  if (modelLower.includes('claude') || modelLower.includes('anthropic')) {
    return 'anthropic';
  }
  if (modelLower.includes('gpt') || modelLower.includes('o1') || modelLower.includes('davinci') || modelLower.includes('curie')) {
    return 'openai';
  }
  if (modelLower.includes('moonshot') || modelLower.includes('kimi') || modelLower.startsWith('k2')) {
    return 'moonshot';
  }
  if (modelLower.includes('gemini')) {
    return 'google';
  }
  if (modelLower.includes('deepseek')) {
    return 'deepseek';
  }
  if (modelLower.includes('llama')) {
    return 'meta';
  }
  if (modelLower.includes('mistral')) {
    return 'mistral';
  }

  return 'unknown';
}
