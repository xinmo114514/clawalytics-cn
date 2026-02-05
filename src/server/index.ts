import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import statsRoutes from './routes/stats.js';
import sessionsRoutes from './routes/sessions.js';
import costsRoutes from './routes/costs.js';
import configRoutes from './routes/config.js';
import tokensRoutes from './routes/tokens.js';
import trendsRoutes from './routes/trends.js';
// OpenClaw Phase 2 routes
import agentsRoutes from './routes/agents.js';
import channelsRoutes from './routes/channels.js';
// OpenClaw Phase 3 routes
import devicesRoutes from './routes/devices.js';
import securityRoutes from './routes/security.js';
import auditRoutes from './routes/audit.js';
import toolsRoutes from './routes/tools.js';
import { startWatcher, stopWatcher, startOpenClawWatcher, stopOpenClawWatcher } from './parser/watcher.js';
import { startSecurityWatcher, stopSecurityWatcher } from './parser/security-watcher.js';
import { loadConfig, ensureConfigDir } from './config/loader.js';
import { getDatabase, closeDatabase } from './db/schema.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import type { Express } from 'express';

const app: Express = express();
const PORT = parseInt(process.env.PORT || '3001');

// Middleware
app.use(cors());
app.use(express.json());

// API routes
app.use('/api/stats', statsRoutes);
app.use('/api/sessions', sessionsRoutes);
app.use('/api/costs', costsRoutes);
app.use('/api/config', configRoutes);
app.use('/api/tokens', tokensRoutes);
app.use('/api/trends', trendsRoutes);
// OpenClaw Phase 2 routes
app.use('/api/agents', agentsRoutes);
app.use('/api/channels', channelsRoutes);
// OpenClaw Phase 3 routes
app.use('/api/devices', devicesRoutes);
app.use('/api/security', securityRoutes);
app.use('/api/audit', auditRoutes);
app.use('/api/tools', toolsRoutes);

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Serve static files in production
if (process.env.NODE_ENV === 'production') {
  const clientPath = path.join(__dirname, '../client');
  app.use(express.static(clientPath));

  // SPA fallback
  app.get('*', (_req, res) => {
    res.sendFile(path.join(clientPath, 'index.html'));
  });
}

// Initialize and start server
async function start() {
  try {
    // Ensure config directory exists
    ensureConfigDir();

    // Initialize database
    getDatabase();
    console.log('Database initialized');

    // Load config and start file watcher
    const config = loadConfig();
    console.log(`Config loaded. Log path: ${config.logPath}`);

    if (config.logPath) {
      startWatcher(config.logPath);
      console.log(`File watcher started for: ${config.logPath}`);
    } else {
      console.warn('No log path configured. File watcher not started.');
    }

    // Start OpenClaw watchers if enabled
    if (config.openClawEnabled) {
      startOpenClawWatcher(config.openClawPath);
      console.log(`OpenClaw watcher started for: ${config.openClawPath}`);

      // Start security watcher if enabled
      if (config.securityAlertsEnabled) {
        startSecurityWatcher({
          openClawPath: config.openClawPath,
          gatewayLogsPath: config.gatewayLogsPath,
          enabled: config.securityAlertsEnabled,
        });
      }
    } else {
      console.log('OpenClaw integration disabled');
    }

    // Start HTTP server
    const server = app.listen(PORT, () => {
      console.log(`\n🦞 Clawalytics server running at http://localhost:${PORT}`);
      console.log(`   Dashboard: http://localhost:${PORT}`);
      console.log(`   API: http://localhost:${PORT}/api`);
      console.log('\nPress Ctrl+C to stop\n');
    });

    // Graceful shutdown
    const shutdown = () => {
      console.log('\nShutting down...');
      stopWatcher();
      stopOpenClawWatcher();
      stopSecurityWatcher();
      closeDatabase();
      server.close(() => {
        console.log('Server stopped');
        process.exit(0);
      });
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Only start if this is the main module
// Use fileURLToPath for proper comparison (handles macOS symlinks like /tmp -> /private/tmp)
import { realpathSync } from 'fs';

const isMainModule = (() => {
  if (!process.argv[1]) return false;
  try {
    const scriptPath = realpathSync(process.argv[1]);
    const modulePath = realpathSync(fileURLToPath(import.meta.url));
    return scriptPath === modulePath;
  } catch {
    return false;
  }
})();

if (isMainModule) {
  start();
}

export { app, start };
