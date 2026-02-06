import { Router, type Request, type Response } from 'express';
import { getAnalyticsService } from '../services/analytics-service.js';

const router: Router = Router();

// Must be BEFORE /:id to avoid matching "stats" as an ID
router.get('/stats', (_req: Request, res: Response): void => {
  try {
    const stats = getAnalyticsService().getSessionStats();
    res.json(stats);
  } catch (error) {
    console.error('Error fetching session stats:', error);
    res.status(500).json({ error: 'Failed to fetch session stats' });
  }
});

router.get('/projects', (req: Request, res: Response): void => {
  try {
    const limit = parseInt(req.query.limit as string) || 10;
    const projects = getAnalyticsService().getProjectBreakdown(limit);
    res.json(projects);
  } catch (error) {
    console.error('Error fetching project breakdown:', error);
    res.status(500).json({ error: 'Failed to fetch project breakdown' });
  }
});

router.get('/filters', (_req: Request, res: Response): void => {
  try {
    const svc = getAnalyticsService();
    const projects = svc.getDistinctProjects();
    const models = svc.getDistinctModels();
    res.json({ projects, models });
  } catch (error) {
    console.error('Error fetching session filters:', error);
    res.status(500).json({ error: 'Failed to fetch session filters' });
  }
});

router.get('/', (req: Request, res: Response): void => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;
    const sortBy = (req.query.sortBy as string) || 'last_activity';
    const sortDir = (req.query.sortDir as string) === 'asc' ? 'asc' as const : 'desc' as const;
    const project = req.query.project as string | undefined;
    const model = req.query.model as string | undefined;
    const search = req.query.search as string | undefined;

    const { sessions, total } = getAnalyticsService().getEnhancedSessions({
      limit, offset, sortBy, sortDir, project, model, search,
    });

    res.json({
      sessions,
      total,
      limit,
      offset,
      hasMore: offset + sessions.length < total,
    });
  } catch (error) {
    console.error('Error fetching sessions:', error);
    res.status(500).json({ error: 'Failed to fetch sessions' });
  }
});

router.get('/:id', (req: Request, res: Response): void => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const session = getAnalyticsService().getSession(id);
    if (!session) {
      res.status(404).json({ error: 'Session not found' });
      return;
    }
    res.json(session);
  } catch (error) {
    console.error('Error fetching session:', error);
    res.status(500).json({ error: 'Failed to fetch session' });
  }
});

router.get('/:id/requests', (req: Request, res: Response): void => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const requests = getAnalyticsService().getRequests(id);
    res.json(requests);
  } catch (error) {
    console.error('Error fetching requests:', error);
    res.status(500).json({ error: 'Failed to fetch requests' });
  }
});

export default router;
