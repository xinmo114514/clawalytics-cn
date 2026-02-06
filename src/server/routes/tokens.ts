import { Router, type Request, type Response } from 'express';
import { getAnalyticsService } from '../services/analytics-service.js';

const router: Router = Router();

// GET /api/tokens/breakdown - Token distribution across all types
router.get('/breakdown', (req: Request, res: Response): void => {
  try {
    const days = req.query.days ? parseInt(req.query.days as string) : undefined;
    const breakdown = getAnalyticsService().getTokenBreakdown(days);
    res.json(breakdown);
  } catch (error) {
    console.error('Error fetching token breakdown:', error);
    res.status(500).json({ error: 'Failed to fetch token breakdown' });
  }
});

export default router;
