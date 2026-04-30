/**
 * Pricing Service
 *
 * Fetches model pricing from a configurable endpoint and caches locally.
 * Falls back to default rates when endpoint is unavailable.
 */

import fs from 'fs';
import path from 'path';
import { getConfigDir } from '../config/loader.js';
import { DEFAULT_RATES, type DefaultRates } from '../config/defaults.js';

// ============================================
// Types
// ============================================

export interface ModelPricing {
  input: number;   // Cost per 1M input tokens
  output: number;  // Cost per 1M output tokens
  cacheRead?: number;   // Cost per 1M cache read tokens (optional)
  cacheWrite?: number;  // Cost per 1M cache write tokens (optional)
}

export interface PricingData {
  models: Record<string, ModelPricing>;  // model ID -> pricing
  fetchedAt: string;                     // ISO timestamp
  source: string;                        // Where pricing came from
}

// ============================================
// Cache Management
// ============================================

const CACHE_FILE = 'pricing-cache.json';
const CACHE_MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours

let memoryCache: PricingData | null = null;
let configuredDefaultRates: DefaultRates = DEFAULT_RATES;
let backgroundRefreshPromise: Promise<void> | null = null;

function getCachePath(): string {
  return path.join(getConfigDir(), CACHE_FILE);
}

/**
 * Load pricing from disk cache
 */
function loadCacheFromDisk(): PricingData | null {
  try {
    const cachePath = getCachePath();
    if (!fs.existsSync(cachePath)) {
      return null;
    }

    const content = fs.readFileSync(cachePath, 'utf-8');
    const data = JSON.parse(content) as PricingData;

    // Check if cache is stale
    const fetchedAt = new Date(data.fetchedAt).getTime();
    const age = Date.now() - fetchedAt;
    if (age > CACHE_MAX_AGE_MS) {
      console.log('Pricing cache is stale, will refresh');
      return data; // Return stale data as fallback
    }

    return data;
  } catch (error) {
    console.error('Error loading pricing cache:', error);
    return null;
  }
}

/**
 * Save pricing to disk cache
 */
function saveCacheToDisk(data: PricingData): void {
  try {
    const cachePath = getCachePath();
    fs.writeFileSync(cachePath, JSON.stringify(data, null, 2), 'utf-8');
  } catch (error) {
    console.error('Error saving pricing cache:', error);
  }
}

// ============================================
// Pricing Fetching
// ============================================

/**
 * Fetch pricing from endpoint
 */
async function fetchPricingFromEndpoint(endpoint: string): Promise<PricingData | null> {
  try {
    const response = await fetch(endpoint, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Clawalytics/0.3.0',
      },
      signal: AbortSignal.timeout(10000), // 10 second timeout
    });

    if (!response.ok) {
      console.warn(`Pricing endpoint returned ${response.status}: ${response.statusText}`);
      return null;
    }

    const data = await response.json() as Record<string, unknown>;

    // Normalize response to PricingData format
    // Support both flat format { "model": { input, output } }
    // and nested format { models: { "model": { input, output } } }
    let models: Record<string, ModelPricing>;

    if (data.models && typeof data.models === 'object') {
      models = data.models as Record<string, ModelPricing>;
    } else {
      // Assume flat format
      models = data as Record<string, ModelPricing>;
    }

    return {
      models,
      fetchedAt: new Date().toISOString(),
      source: endpoint,
    };
  } catch (error) {
    console.warn('Failed to fetch pricing from endpoint:', error);
    return null;
  }
}

/**
 * Convert DEFAULT_RATES to PricingData format
 */
function getDefaultPricingData(rates: DefaultRates = configuredDefaultRates): PricingData {
  const models: Record<string, ModelPricing> = {};

  for (const [provider, providerRates] of Object.entries(rates)) {
    for (const [model, rates] of Object.entries(providerRates)) {
      // Store with provider/model format
      const modelId = `${provider}/${model}`;
      models[modelId] = {
        input: rates.input,
        output: rates.output,
        cacheRead: rates.cacheRead,
        cacheWrite: rates.cacheWrite,
      };
      // Also store without provider prefix for fallback matching
      models[model] = {
        input: rates.input,
        output: rates.output,
        cacheRead: rates.cacheRead,
        cacheWrite: rates.cacheWrite,
      };
    }
  }

  return {
    models,
    fetchedAt: new Date().toISOString(),
    source: 'default',
  };
}

function useDefaultPricingCache(): void {
  memoryCache = getDefaultPricingData();
  saveCacheToDisk(memoryCache);
}

function refreshPricingInBackground(endpoint: string): void {
  if (backgroundRefreshPromise) {
    return;
  }

  backgroundRefreshPromise = refreshPricing(endpoint)
    .then((success) => {
      if (success) {
        console.log(
          `Pricing refreshed from ${endpoint}: ${Object.keys(memoryCache?.models ?? {}).length} models`
        );
        return;
      }

      console.log('Pricing endpoint unavailable, using cached or built-in pricing data');
    })
    .catch((error) => {
      console.warn('Failed to refresh pricing in background:', error);
    })
    .finally(() => {
      backgroundRefreshPromise = null;
    });
}

// ============================================
// Public API
// ============================================

/**
 * Initialize pricing service
 * Loads from cache and optionally refreshes from endpoint
 */
export async function initPricingService(
  endpoint: string | null,
  defaultRates: DefaultRates = DEFAULT_RATES
): Promise<void> {
  configuredDefaultRates = defaultRates;

  // Try to load from disk cache first
  memoryCache = loadCacheFromDisk();

  if (endpoint) {
    if (!memoryCache || memoryCache.source === 'default') {
      useDefaultPricingCache();
      console.log('Using built-in pricing defaults while refreshing pricing in background');
    } else {
      console.log('Using cached pricing data while refreshing pricing in background');
    }

    refreshPricingInBackground(endpoint);
    return;
  }

  if (!memoryCache || memoryCache.source === 'default') {
    console.log('No pricing endpoint configured, using current built-in defaults');
    useDefaultPricingCache();
  } else {
    console.log('Using cached pricing data');
  }
}

/**
 * Get pricing for a specific model
 * Returns null if model not found
 */
export function getModelPricing(provider: string, model: string): ModelPricing | null {
  if (!memoryCache) {
    memoryCache = getDefaultPricingData();
  }

  // Try exact match with provider/model
  const fullId = `${provider}/${model}`;
  if (memoryCache.models[fullId]) {
    return memoryCache.models[fullId];
  }

  // Try just model name
  if (memoryCache.models[model]) {
    return memoryCache.models[model];
  }

  // Try partial matching (for model variants)
  const modelLower = model.toLowerCase();
  for (const [key, pricing] of Object.entries(memoryCache.models)) {
    const keyLower = key.toLowerCase();
    if (keyLower.includes(modelLower) || modelLower.includes(keyLower.split('/').pop() || '')) {
      return pricing;
    }
  }

  return null;
}

/**
 * Get all cached pricing data
 */
export function getAllPricing(): PricingData {
  if (!memoryCache) {
    memoryCache = getDefaultPricingData();
  }
  return memoryCache;
}

/**
 * Force refresh pricing from endpoint
 */
export async function refreshPricing(endpoint: string): Promise<boolean> {
  const freshData = await fetchPricingFromEndpoint(endpoint);
  if (freshData) {
    memoryCache = freshData;
    saveCacheToDisk(freshData);
    return true;
  }
  return false;
}

/**
 * Check if pricing is available for a model
 */
export function hasPricing(provider: string, model: string): boolean {
  return getModelPricing(provider, model) !== null;
}

/**
 * Clear the memory cache and reload from config/defaults
 * Call this when custom rates are updated to ensure latest pricing is used
 */
export function refreshPricingCache(): void {
  memoryCache = getDefaultPricingData(configuredDefaultRates);
  console.log('Pricing cache refreshed from config');
}
