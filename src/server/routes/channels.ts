import { Router, type Request, type Response } from 'express';
import {
  getChannels,
  getChannel,
  getChannelByName,
  getChannelDailyCosts,
  getAllChannelsDailyCosts,
  getChannelStats,
} from '../db/queries-agents.js';

const router: Router = Router();

// GET /api/channels - List all channels
router.get('/', (_req: Request, res: Response): void => {
  try {
    const channels = getChannels();
    res.json(channels);
  } catch (error) {
    console.error('Error fetching channels:', error);
    res.status(500).json({ error: 'Failed to fetch channels' });
  }
});

// GET /api/channels/stats - Get channel statistics summary
router.get('/stats', (req: Request, res: Response): void => {
  try {
    const limit = parseInt(req.query.limit as string) || 10;
    const stats = getChannelStats(limit);
    res.json(stats);
  } catch (error) {
    console.error('Error fetching channel stats:', error);
    res.status(500).json({ error: 'Failed to fetch channel stats' });
  }
});

// GET /api/channels/daily - Get all channels daily costs
router.get('/daily', (req: Request, res: Response): void => {
  try {
    const days = parseInt(req.query.days as string) || 30;
    const dailyCosts = getAllChannelsDailyCosts(days);
    res.json(dailyCosts);
  } catch (error) {
    console.error('Error fetching channels daily costs:', error);
    res.status(500).json({ error: 'Failed to fetch channels daily costs' });
  }
});

// GET /api/channels/by-name/:name - Get channel by name
router.get('/by-name/:name', (req: Request, res: Response): void => {
  try {
    const name = Array.isArray(req.params.name) ? req.params.name[0] : req.params.name;
    const channel = getChannelByName(name);

    if (!channel) {
      res.status(404).json({ error: 'Channel not found' });
      return;
    }

    res.json(channel);
  } catch (error) {
    console.error('Error fetching channel:', error);
    res.status(500).json({ error: 'Failed to fetch channel' });
  }
});

// GET /api/channels/:id - Get single channel details
router.get('/:id', (req: Request, res: Response): void => {
  try {
    const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id);

    if (isNaN(id)) {
      res.status(400).json({ error: 'Invalid channel ID' });
      return;
    }

    const channel = getChannel(id);

    if (!channel) {
      res.status(404).json({ error: 'Channel not found' });
      return;
    }

    res.json(channel);
  } catch (error) {
    console.error('Error fetching channel:', error);
    res.status(500).json({ error: 'Failed to fetch channel' });
  }
});

// GET /api/channels/:id/stats - Get channel statistics
router.get('/:id/stats', (req: Request, res: Response): void => {
  try {
    const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id);

    if (isNaN(id)) {
      res.status(400).json({ error: 'Invalid channel ID' });
      return;
    }

    const channel = getChannel(id);

    if (!channel) {
      res.status(404).json({ error: 'Channel not found' });
      return;
    }

    const days = parseInt(req.query.days as string) || 30;
    const dailyCosts = getChannelDailyCosts(id, days);

    res.json({
      channel,
      dailyCosts,
    });
  } catch (error) {
    console.error('Error fetching channel stats:', error);
    res.status(500).json({ error: 'Failed to fetch channel stats' });
  }
});

// GET /api/channels/:id/daily - Get channel daily costs
router.get('/:id/daily', (req: Request, res: Response): void => {
  try {
    const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id);

    if (isNaN(id)) {
      res.status(400).json({ error: 'Invalid channel ID' });
      return;
    }

    const days = parseInt(req.query.days as string) || 30;
    const dailyCosts = getChannelDailyCosts(id, days);
    res.json(dailyCosts);
  } catch (error) {
    console.error('Error fetching channel daily costs:', error);
    res.status(500).json({ error: 'Failed to fetch channel daily costs' });
  }
});

export default router;
