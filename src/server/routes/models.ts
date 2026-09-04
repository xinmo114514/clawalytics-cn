import { Router, type Request, type Response } from 'express'
import { getAnalyticsService } from '../services/analytics-service.js'
import { getAllPricing } from '../services/pricing-service.js'

const router: Router = Router()

// GET /api/models - List all models with usage data
router.get('/', (req: Request, res: Response): void => {
  try {
    const days = parseInt(req.query.days as string) || 30
    const models = getAnalyticsService().getModelUsage(days)

    // Transform to camelCase
    const result = models.map((m) => ({
      provider: m.provider,
      model: m.model,
      inputTokens: m.input_tokens,
      outputTokens: m.output_tokens,
      cost: m.cost,
      requestCount: m.request_count,
    }))

    res.json(result)
  } catch (error) {
    console.error('Error fetching models:', error)
    res.status(500).json({ error: 'Failed to fetch models' })
  }
})

// GET /api/models/stats - Get model statistics summary
router.get('/stats', (req: Request, res: Response): void => {
  try {
    const days = parseInt(req.query.days as string) || 30
    const stats = getAnalyticsService().getModelStats(days)
    res.json(stats)
  } catch (error) {
    console.error('Error fetching model stats:', error)
    res.status(500).json({ error: 'Failed to fetch model stats' })
  }
})

// GET /api/models/daily - Get daily model usage
router.get('/daily', (req: Request, res: Response): void => {
  try {
    const days = parseInt(req.query.days as string) || 30
    const daily = getAnalyticsService().getModelDailyUsage(days)
    res.json(daily)
  } catch (error) {
    console.error('Error fetching model daily usage:', error)
    res.status(500).json({ error: 'Failed to fetch model daily usage' })
  }
})

// GET /api/models/providers - Get provider summary
router.get('/providers', (req: Request, res: Response): void => {
  try {
    const days = parseInt(req.query.days as string) || 30
    const providers = getAnalyticsService().getProviderSummary(days)
    res.json(providers)
  } catch (error) {
    console.error('Error fetching provider summary:', error)
    res.status(500).json({ error: 'Failed to fetch provider summary' })
  }
})

// GET /api/models/with-cache - Get model usage with cache breakdown
router.get('/with-cache', (req: Request, res: Response): void => {
  try {
    const days = parseInt(req.query.days as string) || 30
    const models = getAnalyticsService().getModelUsageWithCache(days)
    res.json(models)
  } catch (error) {
    console.error('Error fetching models with cache:', error)
    res.status(500).json({ error: 'Failed to fetch models with cache' })
  }
})

// GET /api/models/pricing - Get cached pricing data
router.get('/pricing', (_req: Request, res: Response): void => {
  try {
    const pricing = getAllPricing()
    res.json(pricing)
  } catch (error) {
    console.error('Error fetching pricing:', error)
    res.status(500).json({ error: 'Failed to fetch pricing' })
  }
})

export default router
