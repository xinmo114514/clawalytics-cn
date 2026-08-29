import { Router, type Request, type Response } from 'express'
import { getAnalyticsService } from '../services/analytics-service.js'
import { getBudgetStatus } from '../services/budget-checker.js'

const router: Router = Router()

const MAX_STATS_DAYS = 3650

function parseDays(value: unknown, fallback = 30): number {
  if (value === undefined) return fallback
  const raw = Array.isArray(value) ? value[0] : value
  if (typeof raw !== 'string' || !/^\d+$/.test(raw)) {
    throw new Error('days must be a positive integer')
  }
  const days = Number(raw)
  if (!Number.isSafeInteger(days) || days < 1 || days > MAX_STATS_DAYS) {
    throw new Error(`days must be between 1 and ${MAX_STATS_DAYS}`)
  }
  return days
}

router.get('/', (_req: Request, res: Response): void => {
  try {
    const stats = getAnalyticsService().getStats()
    res.json(stats)
  } catch (error) {
    console.error('Error fetching stats:', error)
    res.status(500).json({ error: 'Failed to fetch stats' })
  }
})

router.get('/enhanced', (_req: Request, res: Response): void => {
  try {
    const stats = getAnalyticsService().getEnhancedStats()
    res.json(stats)
  } catch (error) {
    console.error('Error fetching enhanced stats:', error)
    res.status(500).json({ error: 'Failed to fetch enhanced stats' })
  }
})

router.get('/status', (_req: Request, res: Response): void => {
  try {
    res.json(getAnalyticsService().getStatus())
  } catch (error) {
    console.error('Error fetching analytics status:', error)
    res.status(500).json({ error: 'Failed to fetch analytics status' })
  }
})

router.get('/tokens', (req: Request, res: Response): void => {
  try {
    const days = parseDays(req.query.days)
    const breakdown = getAnalyticsService().getTokenBreakdown(days)
    res.json(breakdown)
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('days ')) {
      res.status(400).json({ error: error.message })
      return
    }
    console.error('Error fetching token breakdown:', error)
    res.status(500).json({ error: 'Failed to fetch token breakdown' })
  }
})

router.get('/token-summary', (_req: Request, res: Response): void => {
  try {
    const summary = getAnalyticsService().getTokenSummary()
    res.json(summary)
  } catch (error) {
    console.error('Error fetching token summary:', error)
    res.status(500).json({ error: 'Failed to fetch token summary' })
  }
})

router.get('/budget', (_req: Request, res: Response): void => {
  try {
    const budget = getBudgetStatus()
    res.json(budget)
  } catch (error) {
    console.error('Error fetching budget status:', error)
    res.status(500).json({ error: 'Failed to fetch budget status' })
  }
})

export default router
