import { Router, type Request, type Response } from 'express';
import {
  getAuditLog,
  getAuditEntry,
  getAuditLogByEntity,
  getAuditLogByActor,
  getRecentAuditLog,
  getAuditStats,
  type AuditFilters,
} from '../db/queries-security.js';

const router: Router = Router();

// GET /api/audit - Get audit log with filters
router.get('/', (req: Request, res: Response): void => {
  try {
    const filters: AuditFilters = {
      action: req.query.action as string | undefined,
      entity_type: req.query.entityType as string | undefined,
      entity_id: req.query.entityId as string | undefined,
      actor: req.query.actor as string | undefined,
      startDate: req.query.startDate as string | undefined,
      endDate: req.query.endDate as string | undefined,
      limit: parseInt(req.query.limit as string) || 100,
      offset: parseInt(req.query.offset as string) || 0,
    };

    const entries = getAuditLog(filters);
    res.json(entries);
  } catch (error) {
    console.error('Error fetching audit log:', error);
    res.status(500).json({ error: 'Failed to fetch audit log' });
  }
});

// GET /api/audit/stats - Get audit statistics
router.get('/stats', (req: Request, res: Response): void => {
  try {
    const hours = parseInt(req.query.hours as string) || 24;
    const stats = getAuditStats(hours);
    res.json(stats);
  } catch (error) {
    console.error('Error fetching audit stats:', error);
    res.status(500).json({ error: 'Failed to fetch audit stats' });
  }
});

// GET /api/audit/recent - Get recent audit entries
router.get('/recent', (req: Request, res: Response): void => {
  try {
    const hours = parseInt(req.query.hours as string) || 24;
    const entries = getRecentAuditLog(hours);
    res.json(entries);
  } catch (error) {
    console.error('Error fetching recent audit log:', error);
    res.status(500).json({ error: 'Failed to fetch recent audit log' });
  }
});

// GET /api/audit/entity/:type/:id - Get audit log for specific entity
router.get('/entity/:type/:id', (req: Request, res: Response): void => {
  try {
    const entityType = Array.isArray(req.params.type) ? req.params.type[0] : req.params.type;
    const entityId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

    const entries = getAuditLogByEntity(entityType, entityId);
    res.json(entries);
  } catch (error) {
    console.error('Error fetching audit log by entity:', error);
    res.status(500).json({ error: 'Failed to fetch audit log by entity' });
  }
});

// GET /api/audit/actor/:actor - Get audit log for specific actor
router.get('/actor/:actor', (req: Request, res: Response): void => {
  try {
    const actor = Array.isArray(req.params.actor) ? req.params.actor[0] : req.params.actor;
    const limit = parseInt(req.query.limit as string) || 100;

    const entries = getAuditLogByActor(actor, limit);
    res.json(entries);
  } catch (error) {
    console.error('Error fetching audit log by actor:', error);
    res.status(500).json({ error: 'Failed to fetch audit log by actor' });
  }
});

// GET /api/audit/:id - Get single audit entry
router.get('/:id', (req: Request, res: Response): void => {
  try {
    const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id);

    if (isNaN(id)) {
      res.status(400).json({ error: 'Invalid audit entry ID' });
      return;
    }

    const entry = getAuditEntry(id);

    if (!entry) {
      res.status(404).json({ error: 'Audit entry not found' });
      return;
    }

    res.json(entry);
  } catch (error) {
    console.error('Error fetching audit entry:', error);
    res.status(500).json({ error: 'Failed to fetch audit entry' });
  }
});

export default router;
