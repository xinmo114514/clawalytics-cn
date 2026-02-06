import { getAnalyticsService } from './analytics-service.js';
import { createAlert } from '../db/queries-security.js';
import { loadConfig } from '../config/loader.js';

// Track which thresholds have already been alerted to avoid spam
const alertedThresholds = new Set<string>();

/**
 * Check current spending against configured budget thresholds.
 * Creates security alerts when budgets are exceeded.
 */
export function checkBudgets(): void {
  const config = loadConfig();
  const { alertThresholds } = config;

  const svc = getAnalyticsService();
  const todayCost = svc.getTodayCost();
  const weekCost = svc.getWeekCost();
  const monthCost = svc.getMonthCost();

  const today = new Date().toISOString().split('T')[0];

  // Check daily budget
  if (alertThresholds.dailyBudget > 0 && todayCost >= alertThresholds.dailyBudget) {
    const key = `daily_${today}`;
    if (!alertedThresholds.has(key)) {
      alertedThresholds.add(key);
      createAlert({
        type: 'budget_daily_exceeded',
        severity: 'high',
        message: `Daily budget exceeded: $${todayCost.toFixed(2)} / $${alertThresholds.dailyBudget.toFixed(2)}`,
        details: JSON.stringify({
          spent: todayCost,
          budget: alertThresholds.dailyBudget,
          period: 'daily',
          date: today,
        }),
      });
      console.log(`[BUDGET] Daily budget exceeded: $${todayCost.toFixed(2)} / $${alertThresholds.dailyBudget.toFixed(2)}`);
    }
  }

  // Check weekly budget
  if (alertThresholds.weeklyBudget > 0 && weekCost >= alertThresholds.weeklyBudget) {
    // Reset weekly alerts on Monday
    const weekKey = `weekly_${getWeekIdentifier()}`;
    if (!alertedThresholds.has(weekKey)) {
      alertedThresholds.add(weekKey);
      createAlert({
        type: 'budget_weekly_exceeded',
        severity: 'medium',
        message: `Weekly budget exceeded: $${weekCost.toFixed(2)} / $${alertThresholds.weeklyBudget.toFixed(2)}`,
        details: JSON.stringify({
          spent: weekCost,
          budget: alertThresholds.weeklyBudget,
          period: 'weekly',
        }),
      });
      console.log(`[BUDGET] Weekly budget exceeded: $${weekCost.toFixed(2)} / $${alertThresholds.weeklyBudget.toFixed(2)}`);
    }
  }

  // Check monthly budget
  if (alertThresholds.monthlyBudget > 0 && monthCost >= alertThresholds.monthlyBudget) {
    const monthKey = `monthly_${today.substring(0, 7)}`; // YYYY-MM
    if (!alertedThresholds.has(monthKey)) {
      alertedThresholds.add(monthKey);
      createAlert({
        type: 'budget_monthly_exceeded',
        severity: 'high',
        message: `Monthly budget exceeded: $${monthCost.toFixed(2)} / $${alertThresholds.monthlyBudget.toFixed(2)}`,
        details: JSON.stringify({
          spent: monthCost,
          budget: alertThresholds.monthlyBudget,
          period: 'monthly',
        }),
      });
      console.log(`[BUDGET] Monthly budget exceeded: $${monthCost.toFixed(2)} / $${alertThresholds.monthlyBudget.toFixed(2)}`);
    }
  }
}

/**
 * Get budget status for the API endpoint
 */
export function getBudgetStatus(): {
  daily: { spent: number; budget: number; percent: number } | null;
  weekly: { spent: number; budget: number; percent: number } | null;
  monthly: { spent: number; budget: number; percent: number } | null;
} {
  const config = loadConfig();
  const { alertThresholds } = config;

  const svc = getAnalyticsService();
  const todayCost = svc.getTodayCost();
  const weekCost = svc.getWeekCost();
  const monthCost = svc.getMonthCost();

  return {
    daily: alertThresholds.dailyBudget > 0
      ? {
          spent: todayCost,
          budget: alertThresholds.dailyBudget,
          percent: Math.min(100, (todayCost / alertThresholds.dailyBudget) * 100),
        }
      : null,
    weekly: alertThresholds.weeklyBudget > 0
      ? {
          spent: weekCost,
          budget: alertThresholds.weeklyBudget,
          percent: Math.min(100, (weekCost / alertThresholds.weeklyBudget) * 100),
        }
      : null,
    monthly: alertThresholds.monthlyBudget > 0
      ? {
          spent: monthCost,
          budget: alertThresholds.monthlyBudget,
          percent: Math.min(100, (monthCost / alertThresholds.monthlyBudget) * 100),
        }
      : null,
  };
}

/**
 * Reset alerted thresholds (useful for testing)
 */
export function resetAlertedThresholds(): void {
  alertedThresholds.clear();
}

function getWeekIdentifier(): string {
  const now = new Date();
  const startOfYear = new Date(now.getFullYear(), 0, 1);
  const weekNumber = Math.ceil(((now.getTime() - startOfYear.getTime()) / 86400000 + startOfYear.getDay() + 1) / 7);
  return `${now.getFullYear()}-W${weekNumber}`;
}
