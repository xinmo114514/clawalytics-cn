import { Router, type Request, type Response } from 'express';
import { getAnalyticsService } from '../services/analytics-service.js';
import { getBudgetStatus } from '../services/budget-checker.js';

const router: Router = Router();

router.get('/', (_req: Request, res: Response): void => {
  try {
    const stats = getAnalyticsService().getStats();
    res.json(stats);
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

router.get('/enhanced', (_req: Request, res: Response): void => {
  try {
    const stats = getAnalyticsService().getEnhancedStats();
    res.json(stats);
  } catch (error) {
    console.error('Error fetching enhanced stats:', error);
    res.status(500).json({ error: 'Failed to fetch enhanced stats' });
  }
});

router.get('/tokens', (req: Request, res: Response): void => {
  try {
    const days = parseInt(req.query.days as string) || 30;
    const breakdown = getAnalyticsService().getTokenBreakdown(days);
    res.json(breakdown);
  } catch (error) {
    console.error('Error fetching token breakdown:', error);
    res.status(500).json({ error: 'Failed to fetch token breakdown' });
  }
});

router.get('/budget', (_req: Request, res: Response): void => {
  try {
    const budget = getBudgetStatus();
    res.json(budget);
  } catch (error) {
    console.error('Error fetching budget status:', error);
    res.status(500).json({ error: 'Failed to fetch budget status' });
  }
});

export default router;
