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
// OpenClaw routes
import agentsRoutes from './routes/agents.js';
import channelsRoutes from './routes/channels.js';
import devicesRoutes from './routes/devices.js';
import securityRoutes from './routes/security.js';
import auditRoutes from './routes/audit.js';
import toolsRoutes from './routes/tools.js';
import modelsRoutes from './routes/models.js';
import exportRoutes from './routes/export.js';
import { initializeAnalyticsService, shutdownAnalyticsService } from './services/analytics-service.js';
import { startSecurityWatcher, stopSecurityWatcher } from './parser/security-watcher.js';
import { loadConfig, ensureConfigDir } from './config/loader.js';
import { getDatabase, closeDatabase } from './db/schema.js';
import { initPricingService } from './services/pricing-service.js';
import { initWebSocket, closeWebSocket } from './ws/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import type { Express } from 'express';

const app: Express = express();
const PORT = parseInt(process.env.PORT || '9174');

// Middleware
app.use(cors());
app.use(express.json());

// Serve static files in production (before API routes)
const clientPath = path.join(__dirname, '../client');
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(clientPath, { index: 'index.html' }));
}

// API routes
app.use('/api/stats', statsRoutes);
app.use('/api/sessions', sessionsRoutes);
app.use('/api/costs', costsRoutes);
app.use('/api/config', configRoutes);
app.use('/api/tokens', tokensRoutes);
app.use('/api/trends', trendsRoutes);
// OpenClaw routes
app.use('/api/agents', agentsRoutes);
app.use('/api/channels', channelsRoutes);
app.use('/api/devices', devicesRoutes);
app.use('/api/security', securityRoutes);
app.use('/api/audit', auditRoutes);
app.use('/api/tools', toolsRoutes);
app.use('/api/models', modelsRoutes);
app.use('/api/export', exportRoutes);

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// SPA fallback - serve index.html for non-API routes (must be after API routes)
app.use((req, res, next) => {
  // Skip API routes
  if (req.path.startsWith('/api')) {
    return next();
  }
  // In production, serve index.html for client-side routing
  if (process.env.NODE_ENV === 'production') {
    res.sendFile(path.join(clientPath, 'index.html'));
  } else {
    next();
  }
});

// Initialize and start server
async function start() {
  try {
    // Ensure config directory exists
    ensureConfigDir();

    // Initialize database (still needed for security tables)
    getDatabase();
    console.log('Database initialized');

    // Load config
    const config = loadConfig();

    // Initialize pricing service
    await initPricingService(config.pricingEndpoint);

    // Initialize analytics service (reads JSONL files directly)
    initializeAnalyticsService(config.openClawPath);

    // Start security watcher if enabled
    if (config.securityAlertsEnabled) {
      startSecurityWatcher({
        openClawPath: config.openClawPath,
        gatewayLogsPath: config.gatewayLogsPath,
        enabled: config.securityAlertsEnabled,
      });
      console.log('Security watcher started');
    }

    // Start HTTP server
    const server = app.listen(PORT, () => {
      console.log(`\n🦞 Clawalytics server running at http://localhost:${PORT}`);
      console.log(`   Dashboard: http://localhost:${PORT}`);
      console.log(`   API: http://localhost:${PORT}/api`);
      console.log('\nPress Ctrl+C to stop\n');
    });

    // Attach WebSocket server
    initWebSocket(server);

    // Graceful shutdown
    const shutdown = () => {
      console.log('\nShutting down...');
      shutdownAnalyticsService();
      stopSecurityWatcher();
      closeWebSocket();
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
