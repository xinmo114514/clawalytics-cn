import { Router, type Request, type Response } from 'express';
import { getWeeklyTrend } from '../db/queries.js';

const router: Router = Router();

// GET /api/trends/weekly - Week-over-week comparison
router.get('/weekly', (_req: Request, res: Response): void => {
  try {
    const trend = getWeeklyTrend();
    res.json(trend);
  } catch (error) {
    console.error('Error fetching weekly trend:', error);
    res.status(500).json({ error: 'Failed to fetch weekly trend' });
  }
});

export default router;
