#!/usr/bin/env node

import { program } from 'commander';
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import os from 'os';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, '../package.json'), 'utf-8'));

const CONFIG_DIR = path.join(os.homedir(), '.clawalytics');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.yaml');

program
  .name('clawalytics')
  .description('🦞 Track your OpenClaw AI spending')
  .version(packageJson.version);

program
  .command('start')
  .description('Start the Clawalytics dashboard')
  .option('-p, --port <port>', 'Port to run the server on', '3000')
  .option('--no-open', 'Don\'t open browser automatically')
  .action(async (options) => {
    const port = parseInt(options.port);

    console.log('🦞 Starting Clawalytics...\n');

    // Set environment variables
    process.env.PORT = port.toString();
    process.env.NODE_ENV = 'production';

    // Import and start the server
    const serverPath = path.join(__dirname, '../dist/server/index.js');

    if (!fs.existsSync(serverPath)) {
      console.error('Error: Server not built. Please run `pnpm build` first.');
      process.exit(1);
    }

    const server = spawn('node', [serverPath], {
      env: { ...process.env, PORT: port.toString(), NODE_ENV: 'production' },
      stdio: 'inherit',
    });

    // Open browser after a short delay
    if (options.open !== false) {
      setTimeout(() => {
        const url = `http://localhost:${port}`;
        const openCommand = process.platform === 'darwin' ? 'open' :
                           process.platform === 'win32' ? 'start' : 'xdg-open';
        spawn(openCommand, [url], { shell: true });
      }, 1500);
    }

    server.on('error', (err) => {
      console.error('Failed to start server:', err);
      process.exit(1);
    });

    server.on('exit', (code) => {
      process.exit(code || 0);
    });
  });

program
  .command('config')
  .description('Open the config file in your default editor')
  .action(() => {
    if (!fs.existsSync(CONFIG_FILE)) {
      console.log('Config file not found. Starting server to create default config...');
      // Create default config by importing the config loader
      console.log(`Config will be created at: ${CONFIG_FILE}`);
      console.log('Run `clawalytics start` first to initialize the config.');
      return;
    }

    const editor = process.env.EDITOR || (process.platform === 'win32' ? 'notepad' : 'vim');
    const child = spawn(editor, [CONFIG_FILE], { stdio: 'inherit' });

    child.on('exit', (code) => {
      if (code === 0) {
        console.log('Config updated successfully.');
      }
    });
  });

program
  .command('status')
  .description('Show current spending stats')
  .option('-p, --port <port>', 'Port where the server is running', '3000')
  .action(async (options) => {
    const port = options.port;
    const url = `http://localhost:${port}/api/stats`;

    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const stats = await response.json();

      console.log('\n🦞 Clawalytics Status\n');
      console.log('──────────────────────────────────');
      console.log(`Today's Spend:     $${stats.todaySpend.toFixed(4)}`);
      console.log(`Weekly Spend:      $${stats.weeklySpend.toFixed(4)}`);
      console.log(`Monthly Spend:     $${stats.monthlySpend.toFixed(4)}`);
      console.log(`Total Sessions:    ${stats.totalSessions}`);
      console.log('──────────────────────────────────');
      console.log(`Today's Tokens:    ${stats.todayTokens.input.toLocaleString()} in / ${stats.todayTokens.output.toLocaleString()} out`);
      console.log('──────────────────────────────────\n');
    } catch (error) {
      console.error('Could not fetch stats. Is the server running?');
      console.error(`Try: clawalytics start --port ${port}`);
      process.exit(1);
    }
  });

program
  .command('path')
  .description('Show the path to config and data files')
  .action(() => {
    console.log('\n🦞 Clawalytics Paths\n');
    console.log('──────────────────────────────────');
    console.log(`Config:    ${CONFIG_FILE}`);
    console.log(`Database:  ${path.join(CONFIG_DIR, 'clawalytics.db')}`);
    console.log(`Data Dir:  ${CONFIG_DIR}`);
    console.log('──────────────────────────────────\n');
  });

program.parse();
