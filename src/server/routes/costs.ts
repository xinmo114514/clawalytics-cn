import { Router, type Request, type Response } from 'express';
import { getAnalyticsService } from '../services/analytics-service.js';

const router: Router = Router();

// GET /api/costs/daily - Daily cost breakdown
router.get('/daily', (req: Request, res: Response): void => {
  try {
    const days = parseInt(req.query.days as string) || 30;
    const costs = getAnalyticsService().getDailyCosts(days);
    res.json(costs);
  } catch (error) {
    console.error('Error fetching daily costs:', error);
    res.status(500).json({ error: 'Failed to fetch daily costs' });
  }
});

// GET /api/costs/by-model - Model usage (original without cache breakdown)
router.get('/by-model', (req: Request, res: Response): void => {
  try {
    const days = parseInt(req.query.days as string) || 30;
    // Use enhanced version with cache token breakdown
    const usage = getAnalyticsService().getModelUsageWithCache(days);
    res.json(usage);
  } catch (error) {
    console.error('Error fetching model usage:', error);
    res.status(500).json({ error: 'Failed to fetch model usage' });
  }
});

// GET /api/costs/summary - Comprehensive cost summary across time periods
router.get('/summary', (_req: Request, res: Response): void => {
  try {
    const summary = getAnalyticsService().getCostSummary();
    res.json(summary);
  } catch (error) {
    console.error('Error fetching cost summary:', error);
    res.status(500).json({ error: 'Failed to fetch cost summary' });
  }
});

// GET /api/costs/cache-savings - Cache savings analysis
router.get('/cache-savings', (req: Request, res: Response): void => {
  try {
    const days = req.query.days ? parseInt(req.query.days as string) : undefined;
    const savings = getAnalyticsService().getCacheSavings(days);
    res.json(savings);
  } catch (error) {
    console.error('Error fetching cache savings:', error);
    res.status(500).json({ error: 'Failed to fetch cache savings' });
  }
});

export default router;
