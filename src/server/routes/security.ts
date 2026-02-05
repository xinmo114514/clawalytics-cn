import { Router, type Request, type Response } from 'express';
import {
  getAlerts,
  getUnacknowledgedAlerts,
  getAlertsBySeverity,
  acknowledgeAlert,
  acknowledgeAllAlerts,
  getAlertStats,
  getConnectionEvents,
  getRecentConnectionEvents,
  getSecurityDashboardStats,
} from '../db/queries-security.js';

const router: Router = Router();

// GET /api/security/dashboard - Get security dashboard stats
router.get('/dashboard', (_req: Request, res: Response): void => {
  try {
    const stats = getSecurityDashboardStats();
    res.json(stats);
  } catch (error) {
    console.error('Error fetching security dashboard:', error);
    res.status(500).json({ error: 'Failed to fetch security dashboard' });
  }
});

// GET /api/security/alerts - List alerts
router.get('/alerts', (req: Request, res: Response): void => {
  try {
    const acknowledged = req.query.acknowledged === 'true' ? true :
                         req.query.acknowledged === 'false' ? false : undefined;
    const limit = parseInt(req.query.limit as string) || 50;

    const alerts = getAlerts(acknowledged, limit);
    res.json(alerts);
  } catch (error) {
    console.error('Error fetching alerts:', error);
    res.status(500).json({ error: 'Failed to fetch alerts' });
  }
});

// GET /api/security/alerts/unacknowledged - List unacknowledged alerts
router.get('/alerts/unacknowledged', (_req: Request, res: Response): void => {
  try {
    const alerts = getUnacknowledgedAlerts();
    res.json(alerts);
  } catch (error) {
    console.error('Error fetching unacknowledged alerts:', error);
    res.status(500).json({ error: 'Failed to fetch unacknowledged alerts' });
  }
});

// GET /api/security/alerts/stats - Get alert statistics
router.get('/alerts/stats', (req: Request, res: Response): void => {
  try {
    const hours = parseInt(req.query.hours as string) || 24;
    const stats = getAlertStats(hours);
    res.json(stats);
  } catch (error) {
    console.error('Error fetching alert stats:', error);
    res.status(500).json({ error: 'Failed to fetch alert stats' });
  }
});

// GET /api/security/alerts/severity/:severity - Get alerts by severity
router.get('/alerts/severity/:severity', (req: Request, res: Response): void => {
  try {
    const severity = Array.isArray(req.params.severity) ? req.params.severity[0] : req.params.severity;
    const limit = parseInt(req.query.limit as string) || 50;

    if (!['low', 'medium', 'high', 'critical'].includes(severity)) {
      res.status(400).json({ error: 'Invalid severity. Must be low, medium, high, or critical' });
      return;
    }

    const alerts = getAlertsBySeverity(severity, limit);
    res.json(alerts);
  } catch (error) {
    console.error('Error fetching alerts by severity:', error);
    res.status(500).json({ error: 'Failed to fetch alerts by severity' });
  }
});

// POST /api/security/alerts/:id/acknowledge - Acknowledge an alert
router.post('/alerts/:id/acknowledge', (req: Request, res: Response): void => {
  try {
    const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id);

    if (isNaN(id)) {
      res.status(400).json({ error: 'Invalid alert ID' });
      return;
    }

    acknowledgeAlert(id);
    res.json({ success: true });
  } catch (error) {
    console.error('Error acknowledging alert:', error);
    res.status(500).json({ error: 'Failed to acknowledge alert' });
  }
});

// POST /api/security/alerts/acknowledge-all - Acknowledge all alerts
router.post('/alerts/acknowledge-all', (_req: Request, res: Response): void => {
  try {
    const count = acknowledgeAllAlerts();
    res.json({ success: true, count });
  } catch (error) {
    console.error('Error acknowledging all alerts:', error);
    res.status(500).json({ error: 'Failed to acknowledge all alerts' });
  }
});

// GET /api/security/connections - Get connection events
router.get('/connections', (req: Request, res: Response): void => {
  try {
    const limit = parseInt(req.query.limit as string) || 100;
    const deviceId = req.query.deviceId as string | undefined;

    const events = getConnectionEvents(limit, deviceId);
    res.json(events);
  } catch (error) {
    console.error('Error fetching connection events:', error);
    res.status(500).json({ error: 'Failed to fetch connection events' });
  }
});

// GET /api/security/connections/recent - Get recent connection events
router.get('/connections/recent', (req: Request, res: Response): void => {
  try {
    const hours = parseInt(req.query.hours as string) || 24;
    const events = getRecentConnectionEvents(hours);
    res.json(events);
  } catch (error) {
    console.error('Error fetching recent connection events:', error);
    res.status(500).json({ error: 'Failed to fetch recent connection events' });
  }
});

export default router;
