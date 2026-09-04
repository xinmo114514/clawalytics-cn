/**
 * Pricing Service
 *
 * Builds the in-memory model-pricing table from bundled defaults and the
 * user's validated manual rate overrides. This service performs no network
 * requests and does not read the legacy remote-pricing cache.
 */
import { createHash } from 'crypto'
import { DEFAULT_RATES, type DefaultRates } from '../config/defaults.js'

// ============================================
// Types
// ============================================

export interface ModelPricing {
  input: number // Cost per 1M input tokens
  output: number // Cost per 1M output tokens
  cacheRead?: number // Cost per 1M cache read tokens (optional)
  cacheWrite?: number // Cost per 1M cache write tokens (optional)
}

export interface PricingData {
  models: Record<string, ModelPricing> // model ID -> pricing
  fetchedAt: string // ISO timestamp
  source: string // Where pricing came from
}

let memoryCache: PricingData | null = null
let configuredDefaultRates: DefaultRates = DEFAULT_RATES

/**
 * Convert DEFAULT_RATES to PricingData format
 */
function getDefaultPricingData(
  rates: DefaultRates = configuredDefaultRates
): PricingData {
  const models: Record<string, ModelPricing> = {}

  for (const [provider, providerRates] of Object.entries(rates)) {
    for (const [model, rates] of Object.entries(providerRates)) {
      // Store with provider/model format
      const modelId = `${provider}/${model}`
      models[modelId] = {
        input: rates.input,
        output: rates.output,
        cacheRead: rates.cacheRead,
        cacheWrite: rates.cacheWrite,
      }
      // Also store without provider prefix for fallback matching
      models[model] = {
        input: rates.input,
        output: rates.output,
        cacheRead: rates.cacheRead,
        cacheWrite: rates.cacheWrite,
      }
    }
  }

  return {
    models,
    fetchedAt: new Date().toISOString(),
    source: 'default',
  }
}

// ============================================
// Public API
// ============================================

/**
 * Initialize pricing service
 * Initializes the in-memory table from bundled and user-configured rates.
 */
export function initPricingService(
  defaultRates: DefaultRates = DEFAULT_RATES
): void {
  configuredDefaultRates = defaultRates
  memoryCache = getDefaultPricingData(defaultRates)
  variantIndex = null
  console.log('Using built-in and user-configured pricing data')
}

// Prefix-variant index over the current pricing table. Rebuilding it scans
// every catalog entry, so memoize it against the current cache object and
// rebuild only when the pricing data is replaced (refresh / config reload).
interface PricingVariantIndex {
  source: PricingData
  variants: Array<{ key: string; pricing: ModelPricing }>
}

let variantIndex: PricingVariantIndex | null = null

function getVariantIndex(): PricingVariantIndex {
  if (variantIndex && memoryCache && variantIndex.source === memoryCache) {
    return variantIndex
  }

  const variants = Object.entries(memoryCache?.models ?? {})
    .map(([key, pricing]) => ({
      key: key.toLowerCase().split('/').pop() || '',
      pricing,
    }))
    .filter(({ key }) => key !== '')
    .sort((left, right) => right.key.length - left.key.length)

  variantIndex = {
    source: memoryCache as PricingData,
    variants,
  }
  return variantIndex
}

/**
 * Get pricing for a specific model
 * Returns null if model not found
 */
export function getModelPricing(
  provider: string,
  model: string
): ModelPricing | null {
  if (!memoryCache) {
    memoryCache = getDefaultPricingData()
  }

  // Try exact match with provider/model
  const fullId = `${provider}/${model}`
  if (memoryCache.models[fullId]) {
    return memoryCache.models[fullId]
  }

  // Try just model name
  if (memoryCache.models[model]) {
    return memoryCache.models[model]
  }

  // Tools disagree on model-name casing (for example Hermes stores
  // `minimax-m3` while the catalog lists `MiniMax-M3`). Match exact names
  // case-insensitively before prefix matching so a real catalog entry is
  // never reported as unpriced.
  const modelLowerName = model.toLowerCase()
  for (const key of Object.keys(memoryCache.models)) {
    if ((key.toLowerCase().split('/').pop() ?? '') === modelLowerName) {
      return memoryCache.models[key]
    }
  }

  // Try safe prefix matching for model variants. The previous bidirectional
  // `includes` fallback could map `gpt-4o` to a `gpt-4` price simply because
  // the shorter name appeared first in the catalog.
  const modelLower = model.toLowerCase()
  for (const { key, pricing } of getVariantIndex().variants) {
    if (
      modelLower.startsWith(`${key}-`) ||
      modelLower.startsWith(`${key}:`) ||
      modelLower.startsWith(`${key}.`)
    ) {
      // Variants are sorted by key length desc, so the first hit is the
      // longest (most specific) match.
      return pricing
    }
  }

  return null
}

/**
 * Get all cached pricing data
 */
export function getAllPricing(): PricingData {
  if (!memoryCache) {
    memoryCache = getDefaultPricingData()
  }
  return memoryCache
}

/** Stable identity for the effective rate table, independent of fetch time. */
export function createPricingFingerprint(
  models: Record<string, ModelPricing>
): string {
  const normalized = Object.keys(models)
    .sort()
    .map((model) => {
      const rates = models[model]
      return [
        model,
        rates.input,
        rates.output,
        rates.cacheRead ?? null,
        rates.cacheWrite ?? null,
      ]
    })

  return createHash('sha256')
    .update(JSON.stringify(normalized))
    .digest('hex')
    .slice(0, 16)
}

export function getPricingFingerprint(): string {
  return createPricingFingerprint(getAllPricing().models)
}

/**
 * Check if pricing is available for a model
 */
export function hasPricing(provider: string, model: string): boolean {
  return getModelPricing(provider, model) !== null
}

/**
 * Clear the memory cache and reload from config/defaults
 * Call this when custom rates are updated to ensure latest pricing is used
 */
/**
 * Replace the in-memory pricing cache with the provided rates.
 *
 * Callers must pass the rate table that was loaded from disk after their most
 * recent change. Using the locally configured rate object (or pulling it from
 * a stale closure) leaves the cache pinned to whatever rates were in effect at
 * process start, which is why prior versions of this function silently ignored
 * post-launch config edits.
 */
export function refreshPricingCache(rates: DefaultRates): void {
  memoryCache = getDefaultPricingData(rates)
  variantIndex = null
  console.log('Pricing cache refreshed from config')
}
