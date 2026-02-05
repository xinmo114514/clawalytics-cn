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
import { startWatcher, stopWatcher } from './parser/watcher.js';
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
