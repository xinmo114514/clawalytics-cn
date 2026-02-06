import { Router, type Request, type Response } from 'express';
import { getAnalyticsService } from '../services/analytics-service.js';

const router: Router = Router();

// GET /api/trends/weekly - Week-over-week comparison
router.get('/weekly', (_req: Request, res: Response): void => {
  try {
    const trend = getAnalyticsService().getWeeklyTrend();
    res.json(trend);
  } catch (error) {
    console.error('Error fetching weekly trend:', error);
    res.status(500).json({ error: 'Failed to fetch weekly trend' });
  }
});

export default router;
