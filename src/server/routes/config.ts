import { Router, type Request, type Response } from 'express';
import fs from 'fs';
import path from 'path';
import {
  getConfigPath,
  getDefaultOpenClawPath,
  loadConfig,
  normalizeOpenClawPath,
  saveConfig,
  type Config,
} from '../config/loader.js';
import { shutdownAnalyticsService, initializeAnalyticsService, getAnalyticsService } from '../services/analytics-service.js';
import { stopSecurityWatcher, startSecurityWatcher } from '../parser/security-watcher.js';

const router: Router = Router();

router.get('/', (_req: Request, res: Response): void => {
  try {
    const config = loadConfig();
    res.json({
      ...config,
      configPath: getConfigPath(),
      defaultOpenClawPath: getDefaultOpenClawPath(),
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
    const nextOpenClawPath = updates.openClawPath !== undefined
      ? normalizeOpenClawPath(updates.openClawPath)
      : currentConfig.openClawPath;

    const newConfig: Config = {
      rates: updates.rates ?? currentConfig.rates,
      alertThresholds: {
        ...currentConfig.alertThresholds,
        ...updates.alertThresholds,
      },
      // OpenClaw settings
      openClawPath: nextOpenClawPath ?? currentConfig.openClawPath,
      gatewayLogsPath: updates.gatewayLogsPath ?? currentConfig.gatewayLogsPath,
      securityAlertsEnabled: updates.securityAlertsEnabled ?? currentConfig.securityAlertsEnabled,
      // Pricing
      pricingEndpoint: updates.pricingEndpoint ?? currentConfig.pricingEndpoint,
    };

    saveConfig(newConfig);
    res.json({
      ...newConfig,
      defaultOpenClawPath: getDefaultOpenClawPath(),
    });
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
    const requestedUpdates = req.body as Partial<Config>;
    const config = loadConfig();
    const requestedOpenClawPath = requestedUpdates.openClawPath !== undefined
      ? normalizeOpenClawPath(requestedUpdates.openClawPath)
      : undefined;
    const effectiveOpenClawPath = requestedOpenClawPath ?? config.openClawPath;

    if (requestedOpenClawPath && requestedOpenClawPath !== config.openClawPath) {
      saveConfig({
        ...config,
        openClawPath: requestedOpenClawPath,
      });
    }

    const openClawPath = effectiveOpenClawPath;

    console.log('Configured OpenClaw path:', openClawPath);

    if (!openClawPath) {
      console.log('Error: OpenClaw path not configured');
      res.status(400).json({ error: 'OpenClaw path not configured', solution: 'Please set the OpenClaw directory path in settings' });
      return;
    }

    if (!fs.existsSync(openClawPath)) {
      console.log('Error: OpenClaw directory does not exist:', openClawPath);
      res.status(400).json({ 
        error: 'OpenClaw directory does not exist', 
        path: openClawPath,
        solution: 'Please check the path and ensure OpenClaw is installed correctly' 
      });
      return;
    }

    // Check directory permissions
    try {
      fs.accessSync(openClawPath, fs.constants.R_OK | fs.constants.X_OK);
    } catch (permError) {
      console.log('Error: Permission denied for OpenClaw directory:', openClawPath);
      res.status(403).json({ 
        error: 'Permission denied for OpenClaw directory', 
        path: openClawPath,
        solution: 'Please ensure you have read and execute permissions for this directory' 
      });
      return;
    }

    console.log('Directory exists and accessible. Checking contents...');
    let contents;
    try {
      contents = fs.readdirSync(openClawPath);
      console.log('Directory contents:', contents);
    } catch (readError) {
      console.log('Error reading OpenClaw directory:', readError);
      res.status(500).json({ 
        error: 'Failed to read OpenClaw directory', 
        details: readError instanceof Error ? readError.message : String(readError),
        solution: 'Please check directory permissions and try again' 
      });
      return;
    }

    // Check if directory structure is valid
    const agentsPath = path.join(openClawPath, 'agents');
    if (!fs.existsSync(agentsPath)) {
      console.log('Warning: Agents directory not found:', agentsPath);
      console.log('This is expected if you have no agents configured yet');
    }

    console.log('Shutting down analytics service...');
    try {
      shutdownAnalyticsService();
    } catch (shutdownError) {
      console.error('Error shutting down analytics service:', shutdownError);
      // Continue with initialization even if shutdown fails
    }

    if (config.securityAlertsEnabled) {
      console.log('Stopping security watcher...');
      try {
        stopSecurityWatcher();
      } catch (stopError) {
        console.error('Error stopping security watcher:', stopError);
        // Continue with initialization even if security watcher stop fails
      }
    }

    console.log('Initializing analytics service with path:', openClawPath);
    try {
      initializeAnalyticsService(openClawPath);
    } catch (initError) {
      console.error('Error initializing analytics service:', initError);
      res.status(500).json({ 
        error: 'Failed to initialize analytics service', 
        details: initError instanceof Error ? initError.message : String(initError),
        solution: 'Please check OpenClaw data format and try again' 
      });
      return;
    }

    if (config.securityAlertsEnabled) {
      console.log('Starting security watcher...');
      try {
        startSecurityWatcher({
          openClawPath,
          gatewayLogsPath: config.gatewayLogsPath,
          enabled: config.securityAlertsEnabled,
        });
      } catch (startError) {
        console.error('Error starting security watcher:', startError);
        // Continue even if security watcher start fails
      }
    }

    let sessionCount;
    try {
      sessionCount = getAnalyticsService().getSessionCount();
      console.log('Session count after reload:', sessionCount);
    } catch (countError) {
      console.error('Error getting session count:', countError);
      sessionCount = 0;
    }

    res.json({
      success: true,
      sessionCount,
      openClawPath,
      message: `Successfully reloaded OpenClaw data from ${openClawPath}`,
      details: {
        directoryAccess: 'Success',
        analyticsService: 'Initialized',
        securityWatcher: config.securityAlertsEnabled ? 'Started' : 'Disabled',
        sessionCount: sessionCount
      }
    });
  } catch (error) {
    console.error('Error reloading OpenClaw data:', error);
    res.status(500).json({ 
      error: 'Failed to reload OpenClaw data', 
      details: error instanceof Error ? error.message : String(error),
      solution: 'Please check logs for more details and try again' 
    });
  }
});

export default router;
