import { Router, type Request, type Response } from 'express';
import {
  getDevices,
  getDevice,
  getActiveDevices,
  getPendingRequests,
  getPairingRequests,
  respondToPairingRequest,
} from '../db/queries-security.js';

const router: Router = Router();

// GET /api/devices - List all paired devices
router.get('/', (_req: Request, res: Response): void => {
  try {
    const devices = getDevices();
    res.json(devices);
  } catch (error) {
    console.error('Error fetching devices:', error);
    res.status(500).json({ error: 'Failed to fetch devices' });
  }
});

// GET /api/devices/active - List active devices only
router.get('/active', (_req: Request, res: Response): void => {
  try {
    const devices = getActiveDevices();
    res.json(devices);
  } catch (error) {
    console.error('Error fetching active devices:', error);
    res.status(500).json({ error: 'Failed to fetch active devices' });
  }
});

// GET /api/devices/pending - List pending pairing requests
router.get('/pending', (_req: Request, res: Response): void => {
  try {
    const requests = getPendingRequests();
    res.json(requests);
  } catch (error) {
    console.error('Error fetching pending requests:', error);
    res.status(500).json({ error: 'Failed to fetch pending requests' });
  }
});

// GET /api/devices/requests - List all pairing requests (history)
router.get('/requests', (req: Request, res: Response): void => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const requests = getPairingRequests(limit);
    res.json(requests);
  } catch (error) {
    console.error('Error fetching pairing requests:', error);
    res.status(500).json({ error: 'Failed to fetch pairing requests' });
  }
});

// GET /api/devices/:id - Get single device details
router.get('/:id', (req: Request, res: Response): void => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const device = getDevice(id);

    if (!device) {
      res.status(404).json({ error: 'Device not found' });
      return;
    }

    res.json(device);
  } catch (error) {
    console.error('Error fetching device:', error);
    res.status(500).json({ error: 'Failed to fetch device' });
  }
});

// POST /api/devices/requests/:id/respond - Respond to a pairing request
router.post('/requests/:id/respond', (req: Request, res: Response): void => {
  try {
    const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id);
    const { status, response } = req.body;

    if (isNaN(id)) {
      res.status(400).json({ error: 'Invalid request ID' });
      return;
    }

    if (!status || !['approved', 'denied'].includes(status)) {
      res.status(400).json({ error: 'Invalid status. Must be "approved" or "denied"' });
      return;
    }

    respondToPairingRequest(id, status, response || '');
    res.json({ success: true });
  } catch (error) {
    console.error('Error responding to pairing request:', error);
    res.status(500).json({ error: 'Failed to respond to pairing request' });
  }
});

export default router;
