import { Router, type Request, type Response } from 'express'
import { DEFAULT_RATES } from '../config/defaults.js'
import {
  getConfigPath,
  getDefaultOpenClawPath,
  loadConfig,
  normalizeDataSourcesConfig,
  normalizeOpenClawPath,
  normalizeWslConfig,
  saveConfig,
  type Config,
} from '../config/loader.js'
import {
  getWslAvailability,
  parseWslUncPath,
  resolveDataSourcePath,
  resolveOpenClawDataPath,
  type ResolvedOpenClawPath,
} from '../lib/wsl-openclaw.js'
import {
  HermesDataValidationError,
  validateHermesDataSource,
} from '../parser/hermes/adapter.js'
import {
  OpenClawDataValidationError,
  validateOpenClawDataSource,
} from '../parser/openclaw/data-source-validator.js'
import {
  stopSecurityWatcher,
  startSecurityWatcher,
} from '../parser/security-watcher.js'
import {
  shutdownAnalyticsService,
  initializeAnalyticsService,
  getAnalyticsService,
} from '../services/analytics-service.js'
import { refreshPricingCache } from '../services/pricing-service.js'

const router: Router = Router()

router.get('/', (_req: Request, res: Response): void => {
  try {
    const config = loadConfig()
    res.json({
      ...config,
      configPath: getConfigPath(),
      defaultOpenClawPath: getDefaultOpenClawPath(),
    })
  } catch {
    res.status(500).json({ error: 'Failed to fetch config' })
  }
})

router.post('/', (req: Request, res: Response): void => {
  try {
    const currentConfig = loadConfig()
    const updates = req.body as Partial<Config>
    const nextWslConfig = normalizeWslConfig({
      ...currentConfig.wsl,
      ...updates.wsl,
    })
    const shouldResolveOpenClawPath =
      updates.openClawPath !== undefined || updates.wsl !== undefined
    const nextOpenClawPath = shouldResolveOpenClawPath
      ? normalizeOpenClawPath(
          updates.openClawPath ?? currentConfig.openClawPath,
          nextWslConfig
        )
      : currentConfig.openClawPath

    const requestedSources = {
      openclaw: {
        ...currentConfig.dataSources.openclaw,
        ...updates.dataSources?.openclaw,
        ...(updates.openClawPath !== undefined
          ? { path: updates.openClawPath }
          : {}),
        ...(updates.wsl?.enabled !== undefined
          ? {
              environment: updates.wsl.enabled
                ? ('wsl' as const)
                : ('local' as const),
            }
          : {}),
      },
      hermes: {
        ...currentConfig.dataSources.hermes,
        ...updates.dataSources?.hermes,
      },
    }
    const nextDataSources = normalizeDataSourcesConfig(
      requestedSources,
      nextOpenClawPath,
      nextWslConfig
    )

    const newConfig: Config = {
      schemaVersion: 3,
      currency: 'CNY',
      dataSources: nextDataSources,
      rates: updates.rates ?? currentConfig.rates,
      alertThresholds: {
        ...currentConfig.alertThresholds,
        ...updates.alertThresholds,
      },
      openClawPath: nextDataSources.openclaw.path,
      gatewayLogsPath: updates.gatewayLogsPath ?? currentConfig.gatewayLogsPath,
      wsl: {
        ...nextWslConfig,
        enabled: nextDataSources.openclaw.environment === 'wsl',
        openClawPath: nextDataSources.openclaw.path,
      },
      securityAlertsEnabled:
        updates.securityAlertsEnabled ?? currentConfig.securityAlertsEnabled,
    }

    saveConfig(newConfig)
    if (updates.rates) {
      refreshPricingCache(loadConfig().rates)
      getAnalyticsService().invalidateCostCache()
    }
    res.json({
      ...newConfig,
      defaultOpenClawPath: getDefaultOpenClawPath(),
    })
  } catch {
    res.status(500).json({ error: 'Failed to save config' })
  }
})

router.post('/rates/:provider/:model', (req: Request, res: Response): void => {
  try {
    const provider = Array.isArray(req.params.provider)
      ? req.params.provider[0]
      : req.params.provider
    const model = Array.isArray(req.params.model)
      ? req.params.model[0]
      : req.params.model
    const { input, output, cacheRead, cacheWrite } = req.body as {
      input: number
      output: number
      cacheRead?: number
      cacheWrite?: number
    }

    // Validate input
    if (typeof input !== 'number' || input < 0 || !Number.isFinite(input)) {
      res
        .status(400)
        .json({ error: 'Invalid input rate: must be a non-negative number' })
      return
    }
    if (typeof output !== 'number' || output < 0 || !Number.isFinite(output)) {
      res
        .status(400)
        .json({ error: 'Invalid output rate: must be a non-negative number' })
      return
    }
    if (
      cacheRead !== undefined &&
      (typeof cacheRead !== 'number' ||
        cacheRead < 0 ||
        !Number.isFinite(cacheRead))
    ) {
      res.status(400).json({
        error: 'Invalid cacheRead rate: must be a non-negative number',
      })
      return
    }
    if (
      cacheWrite !== undefined &&
      (typeof cacheWrite !== 'number' ||
        cacheWrite < 0 ||
        !Number.isFinite(cacheWrite))
    ) {
      res.status(400).json({
        error: 'Invalid cacheWrite rate: must be a non-negative number',
      })
      return
    }

    const config = loadConfig()
    const rates = Object.fromEntries(
      Object.entries(config.rates).map(([name, providerRates]) => [
        name,
        { ...providerRates },
      ])
    )
    if (!rates[provider]) rates[provider] = {}
    rates[provider][model] = {
      input,
      output,
      ...(cacheRead !== undefined ? { cacheRead } : {}),
      ...(cacheWrite !== undefined ? { cacheWrite } : {}),
    }

    saveConfig({ ...config, rates })
    refreshPricingCache(loadConfig().rates)
    getAnalyticsService().invalidateCostCache()
    res.json(rates[provider][model])
  } catch {
    res.status(500).json({ error: 'Failed to update rate' })
  }
})

// GET /api/config/custom-rates - Get all custom rates (non-default)
router.get('/custom-rates', (_req: Request, res: Response): void => {
  try {
    const config = loadConfig()

    // Get all custom rates that differ from defaults
    const customRates: Record<
      string,
      Record<
        string,
        {
          input: number
          output: number
          cacheRead?: number
          cacheWrite?: number
        }
      >
    > = {}

    for (const [provider, providerRates] of Object.entries(config.rates)) {
      const defaultProviderRates = DEFAULT_RATES[provider] || {}
      for (const [model, rate] of Object.entries(providerRates)) {
        const defaultRate = defaultProviderRates[model]
        // Include if it doesn't match the default or is a new model not in defaults
        if (
          !defaultRate ||
          JSON.stringify(rate) !== JSON.stringify(defaultRate)
        ) {
          if (!customRates[provider]) {
            customRates[provider] = {}
          }
          customRates[provider][model] = rate
        }
      }
    }

    res.json(customRates)
  } catch (error) {
    console.error('Error fetching custom rates:', error)
    res.status(500).json({ error: 'Failed to fetch custom rates' })
  }
})

// PUT /api/config/custom-rates/:provider/:model - Update or add a custom rate
router.put(
  '/custom-rates/:provider/:model',
  (req: Request, res: Response): void => {
    try {
      const provider = Array.isArray(req.params.provider)
        ? req.params.provider[0]
        : req.params.provider
      const model = Array.isArray(req.params.model)
        ? req.params.model[0]
        : req.params.model
      const { input, output, cacheRead, cacheWrite } = req.body as {
        input: number
        output: number
        cacheRead?: number
        cacheWrite?: number
      }

      // Validate required fields
      if (typeof input !== 'number' || input < 0 || !Number.isFinite(input)) {
        res
          .status(400)
          .json({ error: 'Invalid input rate: must be a non-negative number' })
        return
      }
      if (
        typeof output !== 'number' ||
        output < 0 ||
        !Number.isFinite(output)
      ) {
        res
          .status(400)
          .json({ error: 'Invalid output rate: must be a non-negative number' })
        return
      }
      if (
        cacheRead !== undefined &&
        (typeof cacheRead !== 'number' ||
          cacheRead < 0 ||
          !Number.isFinite(cacheRead))
      ) {
        res.status(400).json({
          error: 'Invalid cacheRead rate: must be a non-negative number',
        })
        return
      }
      if (
        cacheWrite !== undefined &&
        (typeof cacheWrite !== 'number' ||
          cacheWrite < 0 ||
          !Number.isFinite(cacheWrite))
      ) {
        res.status(400).json({
          error: 'Invalid cacheWrite rate: must be a non-negative number',
        })
        return
      }

      const config = loadConfig()
      const rates = Object.fromEntries(
        Object.entries(config.rates).map(([name, providerRates]) => [
          name,
          { ...providerRates },
        ])
      )
      if (!rates[provider]) rates[provider] = {}

      const oldRate = rates[provider][model]
      rates[provider][model] = {
        input,
        output,
        ...(cacheRead !== undefined ? { cacheRead } : {}),
        ...(cacheWrite !== undefined ? { cacheWrite } : {}),
      }

      saveConfig({ ...config, rates })
      refreshPricingCache(loadConfig().rates)
      getAnalyticsService().invalidateCostCache()

      // Check for significant price change for notification
      const priceChange = oldRate
        ? {
            provider,
            model,
            oldInput: oldRate.input,
            newInput: input,
            oldOutput: oldRate.output,
            newOutput: output,
            significant:
              Math.abs(input - oldRate.input) / oldRate.input > 0.1 ||
              Math.abs(output - oldRate.output) / oldRate.output > 0.1,
          }
        : null

      res.json({
        rate: rates[provider][model],
        priceChange,
      })
    } catch (error) {
      console.error('Error updating custom rate:', error)
      res.status(500).json({ error: 'Failed to update custom rate' })
    }
  }
)

// DELETE /api/config/custom-rates/:provider/:model - Remove a custom rate (restore default)
router.delete(
  '/custom-rates/:provider/:model',
  (req: Request, res: Response): void => {
    try {
      const provider = Array.isArray(req.params.provider)
        ? req.params.provider[0]
        : req.params.provider
      const model = Array.isArray(req.params.model)
        ? req.params.model[0]
        : req.params.model

      const config = loadConfig()

      if (!config.rates[provider] || !config.rates[provider][model]) {
        res.status(404).json({ error: 'Rate not found' })
        return
      }

      const rates = Object.fromEntries(
        Object.entries(config.rates).map(([name, providerRates]) => [
          name,
          { ...providerRates },
        ])
      )
      delete rates[provider][model]
      saveConfig({ ...config, rates })
      refreshPricingCache(loadConfig().rates)
      getAnalyticsService().invalidateCostCache()

      res.json({
        success: true,
        message: `Rate for ${provider}/${model} has been reset to default`,
      })
    } catch (error) {
      console.error('Error deleting custom rate:', error)
      res.status(500).json({ error: 'Failed to delete custom rate' })
    }
  }
)

router.post(
  '/openclaw/reload',
  async (req: Request, res: Response): Promise<void> => {
    try {
      const requestedUpdates = req.body as Partial<Config>
      const config = loadConfig()
      const requestedWslConfig = normalizeWslConfig({
        ...config.wsl,
        ...requestedUpdates.wsl,
      })
      if (requestedUpdates.dataSources?.openclaw?.enabled === false) {
        const dataSources = normalizeDataSourcesConfig(
          {
            ...config.dataSources,
            openclaw: {
              ...config.dataSources.openclaw,
              ...requestedUpdates.dataSources.openclaw,
              enabled: false,
            },
          },
          config.openClawPath,
          requestedWslConfig
        )
        const nextConfig: Config = {
          ...config,
          schemaVersion: 3,
          dataSources,
          wsl: {
            ...requestedWslConfig,
            enabled: dataSources.openclaw.environment === 'wsl',
            openClawPath: dataSources.openclaw.path,
          },
        }
        saveConfig(nextConfig)
        await shutdownAnalyticsService()
        initializeAnalyticsService(nextConfig)
        res.json({
          success: true,
          sessionCount: 0,
          openClawPath: dataSources.openclaw.path,
          message: 'OpenClaw data source disabled',
        })
        return
      }
      const shouldResolveOpenClawPath =
        requestedUpdates.openClawPath !== undefined ||
        requestedUpdates.wsl !== undefined
      const requestedOpenClawPath = shouldResolveOpenClawPath
        ? normalizeOpenClawPath(
            requestedUpdates.openClawPath ?? config.openClawPath,
            requestedWslConfig
          )
        : undefined
      const effectiveOpenClawPath = requestedOpenClawPath ?? config.openClawPath

      const openClawPath = effectiveOpenClawPath
      const sourceInfo = resolveOpenClawDataPath(
        openClawPath,
        requestedWslConfig
      )

      if (!openClawPath) {
        res.status(400).json({
          error: 'OpenClaw path not configured',
          solution: 'Please set the OpenClaw directory path in settings',
        })
        return
      }

      if (sourceInfo?.error) {
        res.status(400).json({
          error: 'Unable to resolve OpenClaw data path',
          details: sourceInfo.error,
          path: openClawPath,
          solution:
            'Check the WSL2 distribution name and OpenClaw Linux path in settings.',
        })
        return
      }

      if (sourceInfo?.isWsl) {
        const availability = getWslAvailability(sourceInfo.distro)
        if (!availability.available) {
          res.status(400).json({
            error: 'WSL2 environment is not available',
            details: availability.error,
            path: openClawPath,
            solution:
              'Start WSL2, confirm the configured distribution exists, and try connecting again.',
          })
          return
        }
      }

      const validation = validateOpenClawDataSource(openClawPath)

      if (
        (requestedOpenClawPath &&
          requestedOpenClawPath !== config.openClawPath) ||
        requestedUpdates.dataSources?.openclaw !== undefined ||
        JSON.stringify(requestedWslConfig) !== JSON.stringify(config.wsl)
      ) {
        const nextDataSources = normalizeDataSourcesConfig(
          {
            ...config.dataSources,
            openclaw: {
              ...config.dataSources.openclaw,
              enabled: true,
              environment: requestedWslConfig.enabled ? 'wsl' : 'local',
              path: effectiveOpenClawPath,
            },
          },
          effectiveOpenClawPath,
          requestedWslConfig
        )
        saveConfig({
          ...config,
          schemaVersion: 3,
          dataSources: nextDataSources,
          openClawPath: nextDataSources.openclaw.path,
          wsl: {
            ...requestedWslConfig,
            openClawPath: nextDataSources.openclaw.path,
          },
        })
      }

      try {
        await shutdownAnalyticsService()
      } catch {
        // Continue with initialization even if shutdown fails
      }

      if (config.securityAlertsEnabled) {
        try {
          stopSecurityWatcher()
        } catch {
          // Continue with initialization even if security watcher stop fails
        }
      }

      try {
        const analyticsService = initializeAnalyticsService(loadConfig())
        await analyticsService.refreshNow()
      } catch (initError) {
        res.status(500).json({
          error: 'Failed to initialize analytics service',
          details:
            initError instanceof Error ? initError.message : String(initError),
          solution: 'Please check OpenClaw data format and try again',
        })
        return
      }

      if (config.securityAlertsEnabled) {
        try {
          startSecurityWatcher({
            openClawPath,
            gatewayLogsPath: config.gatewayLogsPath,
            enabled: config.securityAlertsEnabled,
          })
        } catch {
          // Continue even if security watcher start fails
        }
      }

      let sessionCount = 0
      try {
        sessionCount = getAnalyticsService().getSessionCount()
      } catch {
        // Ignore count errors
      }

      const dataSource = sourceInfo?.isWsl ? 'wsl' : 'local'
      const sourceLabel = sourceInfo?.isWsl
        ? `WSL2${sourceInfo.distro ? ` (${sourceInfo.distro})` : ''}`
        : 'local filesystem'
      console.log(
        `OpenClaw data source verified: ${sourceLabel}; path=${openClawPath}; ` +
          `sessions=${sessionCount}; parsedUsageEntries=${validation.parsedUsageEntries}; ` +
          `formatStatus=${validation.formatStatus}`
      )

      res.json({
        success: true,
        sessionCount,
        openClawPath,
        message: `Successfully reloaded OpenClaw data from ${openClawPath}`,
        details: {
          dataSource,
          source: sourceLabel,
          distro: sourceInfo?.distro,
          linuxPath: sourceInfo?.linuxPath,
          directoryAccess: 'Success',
          analyticsService: 'Initialized',
          securityWatcher: config.securityAlertsEnabled
            ? 'Started'
            : 'Disabled',
          sessionCount: sessionCount,
          agentsFound: validation.agentsFound,
          sessionFilesFound: validation.sessionFilesFound,
          databaseSessionsFound: validation.databaseSessionsFound,
          parsedUsageEntries: validation.parsedUsageEntries,
          formatStatus: validation.formatStatus,
          warnings: validation.warnings,
        },
      })
    } catch (error) {
      if (error instanceof OpenClawDataValidationError) {
        res.status(error.statusCode).json({
          error: error.message,
          path: error.path,
          solution: error.solution,
        })
        return
      }

      res.status(500).json({
        error: 'Failed to reload OpenClaw data',
        details: error instanceof Error ? error.message : String(error),
        solution: 'Please check logs for more details and try again',
      })
    }
  }
)

router.post('/hermes/reload', (req: Request, res: Response): void => {
  try {
    const updates = req.body as Partial<Config>
    const config = loadConfig()
    const nextWsl = normalizeWslConfig({
      ...config.wsl,
      ...updates.wsl,
    })
    const requestedHermes = {
      ...config.dataSources.hermes,
      ...updates.dataSources?.hermes,
      enabled: updates.dataSources?.hermes?.enabled ?? true,
    }
    const dataSources = normalizeDataSourcesConfig(
      {
        ...config.dataSources,
        hermes: requestedHermes,
      },
      config.dataSources.openclaw.path,
      nextWsl
    )
    const hermes = dataSources.hermes

    if (!hermes.enabled) {
      const nextConfig: Config = {
        ...config,
        schemaVersion: 3,
        dataSources,
        wsl: {
          ...nextWsl,
          enabled: dataSources.openclaw.environment === 'wsl',
          openClawPath: dataSources.openclaw.path,
        },
      }
      saveConfig(nextConfig)
      getAnalyticsService().reloadHermesSource('', false)
      res.json({
        success: true,
        sessionCount: 0,
        hermesPath: '',
        message: 'Hermes data source disabled',
      })
      return
    }

    if (!hermes.path) {
      res.status(400).json({
        error: 'Hermes path not configured',
        solution: 'Set the Hermes data directory in settings.',
      })
      return
    }

    // A stored \\wsl.localhost\\... path is already the Windows-facing host
    // path; resolving it again would append a second WSL UNC prefix.
    const parsedHermesUnc = parseWslUncPath(hermes.path)
    const sourceInfo: ResolvedOpenClawPath | undefined = parsedHermesUnc
      ? {
          originalPath: hermes.path,
          hostPath: hermes.path,
          source: 'wsl-unc',
          isWsl: true,
          distro: parsedHermesUnc.distro,
          linuxPath: parsedHermesUnc.linuxPath,
          warnings: [],
        }
      : resolveDataSourcePath(hermes.path, hermes.environment, nextWsl.distro)
    if (sourceInfo?.error) {
      res.status(400).json({
        error: 'Unable to resolve Hermes data path',
        details: sourceInfo.error,
        path: hermes.path,
      })
      return
    }
    if (sourceInfo?.isWsl) {
      const availability = getWslAvailability(sourceInfo.distro)
      if (!availability.available) {
        res.status(400).json({
          error: 'WSL2 environment is not available',
          details: availability.error,
          path: hermes.path,
        })
        return
      }
    }

    const validation = validateHermesDataSource(hermes.path)
    const nextConfig: Config = {
      ...config,
      schemaVersion: 3,
      dataSources,
      wsl: {
        ...nextWsl,
        enabled: dataSources.openclaw.environment === 'wsl',
        openClawPath: dataSources.openclaw.path,
      },
    }
    saveConfig(nextConfig)
    getAnalyticsService().reloadHermesSource(hermes.path, true)

    res.json({
      success: true,
      sessionCount: validation.sessionCount,
      hermesPath: hermes.path,
      message: `Successfully reloaded Hermes data from ${hermes.path}`,
      details: {
        dataSource: sourceInfo?.isWsl ? 'wsl' : 'local',
        source: sourceInfo?.isWsl
          ? `WSL2${sourceInfo.distro ? ` (${sourceInfo.distro})` : ''}`
          : 'local filesystem',
        distro: sourceInfo?.distro,
        linuxPath: sourceInfo?.linuxPath,
        sessionCount: validation.sessionCount,
        usageRecordCount: validation.usageRecordCount,
        warnings: validation.warnings,
      },
    })
  } catch (error) {
    if (error instanceof HermesDataValidationError) {
      res.status(error.statusCode).json({
        error: error.message,
        path: error.dataPath,
        solution: error.solution,
      })
      return
    }
    res.status(500).json({
      error: 'Failed to reload Hermes data',
      details: error instanceof Error ? error.message : String(error),
    })
  }
})

export default router
