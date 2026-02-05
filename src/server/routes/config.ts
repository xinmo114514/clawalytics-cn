import { Router, type Request, type Response } from 'express';
import { loadConfig, saveConfig, getConfigPath, type Config } from '../config/loader.js';

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
      logPath: updates.logPath ?? currentConfig.logPath,
      rates: updates.rates ?? currentConfig.rates,
      alertThresholds: {
        ...currentConfig.alertThresholds,
        ...updates.alertThresholds,
      },
      // OpenClaw settings
      openClawEnabled: updates.openClawEnabled ?? currentConfig.openClawEnabled,
      openClawPath: updates.openClawPath ?? currentConfig.openClawPath,
      gatewayLogsPath: updates.gatewayLogsPath ?? currentConfig.gatewayLogsPath,
      securityAlertsEnabled: updates.securityAlertsEnabled ?? currentConfig.securityAlertsEnabled,
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

export default router;
