import { Router, type Request, type Response } from 'express';
import { getSessions, getSessionCount, getSession, getRequests } from '../db/queries.js';

const router: Router = Router();

router.get('/', (req: Request, res: Response): void => {
  try {
    const limit = parseInt(req.query.limit as string) || 100;
    const offset = parseInt(req.query.offset as string) || 0;

    const sessions = getSessions(limit, offset);
    const total = getSessionCount();

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
    const session = getSession(id);
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
    const requests = getRequests(id);
    res.json(requests);
  } catch (error) {
    console.error('Error fetching requests:', error);
    res.status(500).json({ error: 'Failed to fetch requests' });
  }
});

export default router;
