import { Router, type Request, type Response } from 'express';
import { getStats, getEnhancedStats, getTokenBreakdown } from '../db/queries.js';

const router: Router = Router();

router.get('/', (_req: Request, res: Response): void => {
  try {
    const stats = getStats();
    res.json(stats);
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

router.get('/enhanced', (_req: Request, res: Response): void => {
  try {
    const stats = getEnhancedStats();
    res.json(stats);
  } catch (error) {
    console.error('Error fetching enhanced stats:', error);
    res.status(500).json({ error: 'Failed to fetch enhanced stats' });
  }
});

router.get('/tokens', (req: Request, res: Response): void => {
  try {
    const days = parseInt(req.query.days as string) || 30;
    const breakdown = getTokenBreakdown(days);
    res.json(breakdown);
  } catch (error) {
    console.error('Error fetching token breakdown:', error);
    res.status(500).json({ error: 'Failed to fetch token breakdown' });
  }
});

export default router;
