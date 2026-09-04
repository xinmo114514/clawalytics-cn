import { Router, type Request, type Response } from 'express'
import {
  getDevices,
  getDevice,
  getActiveDevices,
  getPendingRequests,
  getPairingRequests,
} from '../db/queries-security.js'

const router: Router = Router()

// GET /api/devices - List all paired devices
router.get('/', (_req: Request, res: Response): void => {
  try {
    const devices = getDevices()
    res.json(devices)
  } catch (error) {
    console.error('Error fetching devices:', error)
    res.status(500).json({ error: 'Failed to fetch devices' })
  }
})

// GET /api/devices/active - List active devices only
router.get('/active', (_req: Request, res: Response): void => {
  try {
    const devices = getActiveDevices()
    res.json(devices)
  } catch (error) {
    console.error('Error fetching active devices:', error)
    res.status(500).json({ error: 'Failed to fetch active devices' })
  }
})

// GET /api/devices/pending - List pending pairing requests
router.get('/pending', (_req: Request, res: Response): void => {
  try {
    const requests = getPendingRequests()
    res.json(requests)
  } catch (error) {
    console.error('Error fetching pending requests:', error)
    res.status(500).json({ error: 'Failed to fetch pending requests' })
  }
})

// GET /api/devices/requests - List all pairing requests (history)
router.get('/requests', (req: Request, res: Response): void => {
  try {
    const limit = parseInt(req.query.limit as string) || 50
    const requests = getPairingRequests(limit)
    res.json(requests)
  } catch (error) {
    console.error('Error fetching pairing requests:', error)
    res.status(500).json({ error: 'Failed to fetch pairing requests' })
  }
})

// GET /api/devices/:id - Get single device details
router.get('/:id', (req: Request, res: Response): void => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id
    const device = getDevice(id)

    if (!device) {
      res.status(404).json({ error: 'Device not found' })
      return
    }

    res.json(device)
  } catch (error) {
    console.error('Error fetching device:', error)
    res.status(500).json({ error: 'Failed to fetch device' })
  }
})

export default router
