import { getAnalyticsService } from './analytics-service.js';
import { createAlert } from '../db/queries-security.js';

interface AnomalyResult {
  type: string;
  severity: 'low' | 'medium' | 'high';
  message: string;
  details: Record<string, unknown>;
}

// Track known models to detect new ones
const knownModels = new Set<string>();
let lastCheckDate = '';

/**
 * Run anomaly detection checks.
 * Call this periodically (e.g., after processing log batches).
 */
export function detectAnomalies(): AnomalyResult[] {
  const anomalies: AnomalyResult[] = [];

  const today = new Date().toISOString().split('T')[0];

  // Only run once per day to avoid spam
  if (lastCheckDate === today) return anomalies;
  lastCheckDate = today;

  // 1. Cost spike detection (7-day rolling average comparison)
  const costSpike = detectCostSpike();
  if (costSpike) anomalies.push(costSpike);

  // 2. Model spike detection
  const modelSpikes = detectModelSpikes();
  anomalies.push(...modelSpikes);

  // 3. New model detection
  const newModels = detectNewModels();
  anomalies.push(...newModels);

  // Create alerts for any anomalies found
  for (const anomaly of anomalies) {
    createAlert({
      type: `anomaly_${anomaly.type}`,
      severity: anomaly.severity,
      message: anomaly.message,
      details: JSON.stringify(anomaly.details),
    });
  }

  return anomalies;
}

/**
 * Detect if today's spending significantly exceeds the rolling 7-day average.
 */
function detectCostSpike(): AnomalyResult | null {
  const svc = getAnalyticsService();
  const costs = svc.getDailyCosts(14);
  if (costs.length < 8) return null; // Need enough data

  // Separate today from the previous 7 days
  const today = costs[costs.length - 1];
  const previous7 = costs.slice(-8, -1);

  if (previous7.length === 0) return null;

  const avgCost = previous7.reduce((sum, d) => sum + d.total_cost, 0) / previous7.length;

  if (avgCost <= 0) return null;

  const ratio = today.total_cost / avgCost;

  // Alert if today's cost is more than 3x the average
  if (ratio >= 3 && today.total_cost > 1) {
    return {
      type: 'cost_spike',
      severity: ratio >= 5 ? 'high' : 'medium',
      message: `Daily cost spike: $${today.total_cost.toFixed(2)} is ${ratio.toFixed(1)}x your 7-day average ($${avgCost.toFixed(2)})`,
      details: {
        todayCost: today.total_cost,
        averageCost: avgCost,
        ratio,
        date: today.date,
      },
    };
  }

  return null;
}

/**
 * Detect if any single model's cost spiked significantly.
 */
function detectModelSpikes(): AnomalyResult[] {
  const anomalies: AnomalyResult[] = [];
  const svc = getAnalyticsService();

  // Compare last 7 days vs previous 7 days per model
  const recent = svc.getModelUsage(7);
  const previous = svc.getModelUsage(14);

  for (const model of recent) {
    const key = `${model.provider}/${model.model}`;
    const prev = previous.find(
      (m) => m.provider === model.provider && m.model === model.model
    );

    if (!prev || prev.cost <= 0) continue;

    // Compare cost (recent is 7-day total, previous is 14-day total)
    // Normalize previous to 7-day equivalent
    const prevNormalized = prev.cost / 2;
    if (prevNormalized <= 0) continue;

    const ratio = model.cost / prevNormalized;

    if (ratio >= 3 && model.cost > 0.5) {
      anomalies.push({
        type: 'model_spike',
        severity: 'medium',
        message: `Model cost spike: ${key} cost $${model.cost.toFixed(2)} this week (${ratio.toFixed(1)}x previous week)`,
        details: {
          model: key,
          recentCost: model.cost,
          previousCost: prevNormalized,
          ratio,
        },
      });
    }
  }

  return anomalies;
}

/**
 * Detect new models that haven't been seen before.
 */
function detectNewModels(): AnomalyResult[] {
  const anomalies: AnomalyResult[] = [];
  const svc = getAnalyticsService();
  const currentModels = svc.getModelUsage(1);

  // Initialize known models from historical data on first run
  if (knownModels.size === 0) {
    const allModels = svc.getModelUsage(90);
    for (const m of allModels) {
      knownModels.add(`${m.provider}/${m.model}`);
    }
    return anomalies; // Don't alert on first run
  }

  for (const model of currentModels) {
    const key = `${model.provider}/${model.model}`;
    if (!knownModels.has(key)) {
      knownModels.add(key);
      anomalies.push({
        type: 'new_model',
        severity: 'low',
        message: `New model detected: ${key}`,
        details: {
          provider: model.provider,
          model: model.model,
          cost: model.cost,
          requestCount: model.request_count,
        },
      });
    }
  }

  return anomalies;
}

/**
 * Reset anomaly detection state (useful for testing).
 */
export function resetAnomalyState(): void {
  knownModels.clear();
  lastCheckDate = '';
}
