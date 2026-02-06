import { Router, type Request, type Response } from 'express';
import { getAnalyticsService } from '../services/analytics-service.js';

const router: Router = Router();

// GET /api/agents - List all agents
router.get('/', (_req: Request, res: Response): void => {
  try {
    const agents = getAnalyticsService().getAgents();
    res.json(agents);
  } catch (error) {
    console.error('Error fetching agents:', error);
    res.status(500).json({ error: 'Failed to fetch agents' });
  }
});

// GET /api/agents/stats - Get agent statistics summary
router.get('/stats', (req: Request, res: Response): void => {
  try {
    const limit = parseInt(req.query.limit as string) || 10;
    const stats = getAnalyticsService().getAgentStatsResult(limit);
    res.json(stats);
  } catch (error) {
    console.error('Error fetching agent stats:', error);
    res.status(500).json({ error: 'Failed to fetch agent stats' });
  }
});

// GET /api/agents/daily - Get all agents daily costs
router.get('/daily', (req: Request, res: Response): void => {
  try {
    const days = parseInt(req.query.days as string) || 30;
    const dailyCosts = getAnalyticsService().getAllAgentsDailyCosts(days);
    res.json(dailyCosts);
  } catch (error) {
    console.error('Error fetching agents daily costs:', error);
    res.status(500).json({ error: 'Failed to fetch agents daily costs' });
  }
});

// GET /api/agents/:id - Get single agent details
router.get('/:id', (req: Request, res: Response): void => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const agent = getAnalyticsService().getAgent(id);

    if (!agent) {
      res.status(404).json({ error: 'Agent not found' });
      return;
    }

    res.json(agent);
  } catch (error) {
    console.error('Error fetching agent:', error);
    res.status(500).json({ error: 'Failed to fetch agent' });
  }
});

// GET /api/agents/:id/stats - Get agent statistics
router.get('/:id/stats', (req: Request, res: Response): void => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const agent = getAnalyticsService().getAgent(id);

    if (!agent) {
      res.status(404).json({ error: 'Agent not found' });
      return;
    }

    const days = parseInt(req.query.days as string) || 30;
    const dailyCosts = getAnalyticsService().getAgentDailyCosts(id, days);

    res.json({
      agent,
      dailyCosts,
    });
  } catch (error) {
    console.error('Error fetching agent stats:', error);
    res.status(500).json({ error: 'Failed to fetch agent stats' });
  }
});

// GET /api/agents/:id/daily - Get agent daily costs
router.get('/:id/daily', (req: Request, res: Response): void => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const days = parseInt(req.query.days as string) || 30;
    const dailyCosts = getAnalyticsService().getAgentDailyCosts(id, days);
    res.json(dailyCosts);
  } catch (error) {
    console.error('Error fetching agent daily costs:', error);
    res.status(500).json({ error: 'Failed to fetch agent daily costs' });
  }
});

export default router;
