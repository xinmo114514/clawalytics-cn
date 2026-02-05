import { Router, type Request, type Response } from 'express';
import {
  getOutboundCalls,
  getOutboundCallsBySession,
  getOutboundCallsByTool,
  getOutboundCallStats,
} from '../db/queries-security.js';

const router: Router = Router();

// GET /api/tools - List outbound tool calls
router.get('/', (req: Request, res: Response): void => {
  try {
    const limit = parseInt(req.query.limit as string) || 100;
    const agentId = req.query.agentId as string | undefined;

    const calls = getOutboundCalls(limit, agentId);
    res.json(calls);
  } catch (error) {
    console.error('Error fetching outbound calls:', error);
    res.status(500).json({ error: 'Failed to fetch outbound calls' });
  }
});

// GET /api/tools/stats - Get tool usage statistics
router.get('/stats', (req: Request, res: Response): void => {
  try {
    const days = parseInt(req.query.days as string) || 30;
    const stats = getOutboundCallStats(days);
    res.json(stats);
  } catch (error) {
    console.error('Error fetching tool stats:', error);
    res.status(500).json({ error: 'Failed to fetch tool stats' });
  }
});

// GET /api/tools/by-name/:name - Get calls for a specific tool
router.get('/by-name/:name', (req: Request, res: Response): void => {
  try {
    const toolName = Array.isArray(req.params.name) ? req.params.name[0] : req.params.name;
    const limit = parseInt(req.query.limit as string) || 100;

    const calls = getOutboundCallsByTool(toolName, limit);
    res.json(calls);
  } catch (error) {
    console.error('Error fetching tool calls by name:', error);
    res.status(500).json({ error: 'Failed to fetch tool calls by name' });
  }
});

// GET /api/tools/session/:sessionId - Get calls for a specific session
router.get('/session/:sessionId', (req: Request, res: Response): void => {
  try {
    const sessionId = Array.isArray(req.params.sessionId) ? req.params.sessionId[0] : req.params.sessionId;

    const calls = getOutboundCallsBySession(sessionId);
    res.json(calls);
  } catch (error) {
    console.error('Error fetching tool calls by session:', error);
    res.status(500).json({ error: 'Failed to fetch tool calls by session' });
  }
});

export default router;
