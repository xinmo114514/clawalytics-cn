import { Router, type Request, type Response } from 'express';
import fs from 'fs';
import { loadConfig, saveConfig, getConfigPath, type Config } from '../config/loader.js';
import { shutdownAnalyticsService, initializeAnalyticsService, getAnalyticsService } from '../services/analytics-service.js';
import { stopSecurityWatcher, startSecurityWatcher } from '../parser/security-watcher.js';

const router: Router = Router();

router.get('/', (_req: Request, res: Response): void => {
  try {
    const config = loadConfig();
    res.json({
      ...config,
      configPath: getConfigPath(),
    });
  } catch (error) {
    console.error('Error fetching config:', error);
    res.status(500).json({ error: 'Failed to fetch config' });
  }
});

router.post('/', (req: Request, res: Response): void => {
  try {
    const currentConfig = loadConfig();
    const updates = req.body as Partial<Config>;

    const newConfig: Config = {
      rates: updates.rates ?? currentConfig.rates,
      alertThresholds: {
        ...currentConfig.alertThresholds,
        ...updates.alertThresholds,
      },
      // OpenClaw settings
      openClawPath: updates.openClawPath ?? currentConfig.openClawPath,
      gatewayLogsPath: updates.gatewayLogsPath ?? currentConfig.gatewayLogsPath,
      securityAlertsEnabled: updates.securityAlertsEnabled ?? currentConfig.securityAlertsEnabled,
      // Pricing
      pricingEndpoint: updates.pricingEndpoint ?? currentConfig.pricingEndpoint,
    };

    saveConfig(newConfig);
    res.json(newConfig);
  } catch (error) {
    console.error('Error saving config:', error);
    res.status(500).json({ error: 'Failed to save config' });
  }
});

router.post('/rates/:provider/:model', (req: Request, res: Response): void => {
  try {
    const provider = Array.isArray(req.params.provider) ? req.params.provider[0] : req.params.provider;
    const model = Array.isArray(req.params.model) ? req.params.model[0] : req.params.model;
    const { input, output } = req.body as { input: number; output: number };

    const config = loadConfig();
    if (!config.rates[provider]) {
      config.rates[provider] = {};
    }
    config.rates[provider][model] = { input, output };

    saveConfig(config);
    res.json(config.rates[provider][model]);
  } catch (error) {
    console.error('Error updating rate:', error);
    res.status(500).json({ error: 'Failed to update rate' });
  }
});

router.post('/openclaw/reload', (req: Request, res: Response): void => {
  try {
    console.log('=== OpenClaw Reload Request ===');
    const config = loadConfig();
    const openClawPath = config.openClawPath;

    console.log('Configured OpenClaw path:', openClawPath);

    if (!openClawPath) {
      console.log('Error: OpenClaw path not configured');
      res.status(400).json({ error: 'OpenClaw path not configured' });
      return;
    }

    if (!fs.existsSync(openClawPath)) {
      console.log('Error: OpenClaw directory does not exist:', openClawPath);
      res.status(400).json({ error: 'OpenClaw directory does not exist', path: openClawPath });
      return;
    }

    console.log('Directory exists. Checking contents...');
    const contents = fs.readdirSync(openClawPath);
    console.log('Directory contents:', contents);

    console.log('Shutting down analytics service...');
    shutdownAnalyticsService();

    if (config.securityAlertsEnabled) {
      console.log('Stopping security watcher...');
      stopSecurityWatcher();
    }

    console.log('Initializing analytics service with path:', openClawPath);
    initializeAnalyticsService(openClawPath);

    if (config.securityAlertsEnabled) {
      console.log('Starting security watcher...');
      startSecurityWatcher({
        openClawPath: config.openClawPath,
        gatewayLogsPath: config.gatewayLogsPath,
        enabled: config.securityAlertsEnabled,
      });
    }

    const sessionCount = getAnalyticsService().getSessionCount();
    console.log('Session count after reload:', sessionCount);

    res.json({
      success: true,
      sessionCount,
      openClawPath,
      message: `Successfully reloaded OpenClaw data from ${openClawPath}`,
    });
  } catch (error) {
    console.error('Error reloading OpenClaw data:', error);
    res.status(500).json({ error: 'Failed to reload OpenClaw data', details: error instanceof Error ? error.message : String(error) });
  }
});

export default router;
