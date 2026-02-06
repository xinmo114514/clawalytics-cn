import { Router, type Request, type Response } from 'express';
import { getAnalyticsService } from '../services/analytics-service.js';
import { getOutboundCallsWithCount, getAuditLogWithCount } from '../db/queries-security.js';

const router: Router = Router();

function toCsv(headers: string[], rows: unknown[][]): string {
  const escape = (val: unknown) => {
    const str = String(val ?? '');
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const lines = [headers.join(',')];
  for (const row of rows) {
    lines.push(row.map(escape).join(','));
  }
  return lines.join('\n');
}

function sendExport(res: Response, format: string, filename: string, headers: string[], rows: unknown[][], jsonData: unknown): void {
  if (format === 'csv') {
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}.csv"`);
    res.send(toCsv(headers, rows));
  } else {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}.json"`);
    res.json(jsonData);
  }
}

// GET /api/export/costs
router.get('/costs', (req: Request, res: Response): void => {
  try {
    const days = parseInt(req.query.days as string) || 30;
    const format = (req.query.format as string) || 'csv';
    const data = getAnalyticsService().getDailyCosts(days);

    const headers = ['date', 'total_cost', 'input_tokens', 'output_tokens', 'cache_creation_tokens', 'cache_read_tokens', 'cache_savings', 'session_count', 'request_count'];
    const rows = data.map(d => [d.date, d.total_cost, d.total_input_tokens, d.total_output_tokens, d.cache_creation_tokens, d.cache_read_tokens, d.cache_savings, d.session_count, d.request_count]);

    sendExport(res, format, 'clawalytics-costs', headers, rows, data);
  } catch (error) {
    console.error('Error exporting costs:', error);
    res.status(500).json({ error: 'Failed to export costs' });
  }
});

// GET /api/export/models
router.get('/models', (req: Request, res: Response): void => {
  try {
    const days = parseInt(req.query.days as string) || 30;
    const format = (req.query.format as string) || 'csv';
    const data = getAnalyticsService().getModelUsage(days);

    const headers = ['provider', 'model', 'input_tokens', 'output_tokens', 'cost', 'request_count'];
    const rows = data.map(d => [d.provider, d.model, d.input_tokens, d.output_tokens, d.cost, d.request_count]);

    sendExport(res, format, 'clawalytics-models', headers, rows, data);
  } catch (error) {
    console.error('Error exporting models:', error);
    res.status(500).json({ error: 'Failed to export models' });
  }
});

// GET /api/export/agents
router.get('/agents', (req: Request, res: Response): void => {
  try {
    const format = (req.query.format as string) || 'csv';
    const data = getAnalyticsService().getAgents();

    const headers = ['id', 'name', 'workspace', 'created_at', 'total_cost', 'total_input_tokens', 'total_output_tokens', 'session_count'];
    const rows = data.map(d => [d.id, d.name, d.workspace, d.created_at, d.total_cost, d.total_input_tokens, d.total_output_tokens, d.session_count]);

    sendExport(res, format, 'clawalytics-agents', headers, rows, data);
  } catch (error) {
    console.error('Error exporting agents:', error);
    res.status(500).json({ error: 'Failed to export agents' });
  }
});

// GET /api/export/sessions
router.get('/sessions', (req: Request, res: Response): void => {
  try {
    const format = (req.query.format as string) || 'csv';
    const limit = parseInt(req.query.limit as string) || 1000;
    const data = getAnalyticsService().getSessions(limit);

    const headers = ['id', 'project_path', 'started_at', 'last_activity', 'total_input_tokens', 'total_output_tokens', 'total_cost', 'models_used'];
    const rows = data.map(d => [d.id, d.project_path, d.started_at, d.last_activity, d.total_input_tokens, d.total_output_tokens, d.total_cost, d.models_used.join('; ')]);

    sendExport(res, format, 'clawalytics-sessions', headers, rows, data);
  } catch (error) {
    console.error('Error exporting sessions:', error);
    res.status(500).json({ error: 'Failed to export sessions' });
  }
});

// GET /api/export/tools (still uses DB for outbound_calls)
router.get('/tools', (req: Request, res: Response): void => {
  try {
    const format = (req.query.format as string) || 'csv';
    const limit = parseInt(req.query.limit as string) || 1000;
    const { calls } = getOutboundCallsWithCount({ limit });

    const headers = ['id', 'session_id', 'agent_id', 'tool_name', 'timestamp', 'duration_ms', 'status', 'error'];
    const rows = calls.map(d => [d.id, d.session_id, d.agent_id, d.tool_name, d.timestamp, d.duration_ms, d.status, d.error]);

    sendExport(res, format, 'clawalytics-tools', headers, rows, calls);
  } catch (error) {
    console.error('Error exporting tools:', error);
    res.status(500).json({ error: 'Failed to export tools' });
  }
});

// GET /api/export/audit (stays on DB)
router.get('/audit', (req: Request, res: Response): void => {
  try {
    const format = (req.query.format as string) || 'csv';
    const limit = parseInt(req.query.limit as string) || 1000;
    const { entries } = getAuditLogWithCount({ limit });

    const headers = ['id', 'action', 'entity_type', 'entity_id', 'timestamp', 'actor', 'details', 'ip_address'];
    const rows = entries.map(d => [d.id, d.action, d.entity_type, d.entity_id, d.timestamp, d.actor, d.details, d.ip_address]);

    sendExport(res, format, 'clawalytics-audit', headers, rows, entries);
  } catch (error) {
    console.error('Error exporting audit log:', error);
    res.status(500).json({ error: 'Failed to export audit log' });
  }
});

export default router;
