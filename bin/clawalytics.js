#!/usr/bin/env node

import { program } from 'commander';
import { spawn, execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import os from 'os';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, '../package.json'), 'utf-8'));

const CONFIG_DIR = path.join(os.homedir(), '.clawalytics');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.yaml');
const LOG_FILE = path.join(CONFIG_DIR, 'clawalytics.log');
const DEFAULT_PORT = '9174';
const UPDATE_CHECK_FILE = path.join(CONFIG_DIR, 'update-check.json');
const UPDATE_CHECK_INTERVAL = 24 * 60 * 60 * 1000; // 24 hours

const SERVICE_LABEL = 'com.clawalytics.dashboard';
const TASK_NAME = 'Clawalytics';

// ============================================
// Update notifier (non-blocking)
// ============================================

function checkUpdateBanner() {
  try {
    if (!fs.existsSync(UPDATE_CHECK_FILE)) return;
    const data = JSON.parse(fs.readFileSync(UPDATE_CHECK_FILE, 'utf-8'));
    if (data.latest && data.latest !== packageJson.version && compareVersions(data.latest, packageJson.version) > 0) {
      const yellow = '\x1b[33m';
      const cyan = '\x1b[36m';
      const bold = '\x1b[1m';
      const reset = '\x1b[0m';
      console.log('');
      console.log(`  ${yellow}╭───────────────────────────────────────────╮${reset}`);
      console.log(`  ${yellow}│${reset}                                           ${yellow}│${reset}`);
      console.log(`  ${yellow}│${reset}   Update available ${reset}v${packageJson.version}${reset} → ${cyan}${bold}v${data.latest}${reset}          ${yellow}│${reset}`);
      console.log(`  ${yellow}│${reset}   Run ${cyan}clawalytics update${reset} to update        ${yellow}│${reset}`);
      console.log(`  ${yellow}│${reset}                                           ${yellow}│${reset}`);
      console.log(`  ${yellow}╰───────────────────────────────────────────╯${reset}`);
      console.log('');
    }
  } catch {}
}

function scheduleUpdateCheck() {
  try {
    if (fs.existsSync(UPDATE_CHECK_FILE)) {
      const data = JSON.parse(fs.readFileSync(UPDATE_CHECK_FILE, 'utf-8'));
      if (Date.now() - data.checkedAt < UPDATE_CHECK_INTERVAL) return;
    }

    fetch('https://registry.npmjs.org/clawalytics/latest')
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data?.version) {
          if (!fs.existsSync(CONFIG_DIR)) fs.mkdirSync(CONFIG_DIR, { recursive: true });
          fs.writeFileSync(UPDATE_CHECK_FILE, JSON.stringify({
            latest: data.version,
            checkedAt: Date.now(),
          }));
        }
      })
      .catch(() => {});
  } catch {}
}

function compareVersions(a, b) {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    if ((pa[i] || 0) > (pb[i] || 0)) return 1;
    if ((pa[i] || 0) < (pb[i] || 0)) return -1;
  }
  return 0;
}

checkUpdateBanner();
scheduleUpdateCheck();

// ============================================
// Helpers
// ============================================

function getServerIPs() {
  const interfaces = os.networkInterfaces();
  const ips = [];
  for (const iface of Object.values(interfaces)) {
    if (!iface) continue;
    for (const addr of iface) {
      if (addr.family === 'IPv4' && !addr.internal) {
        ips.push(addr.address);
      }
    }
  }
  return ips;
}

function getRunningPid() {
  try {
    if (process.platform === 'win32') {
      const output = execSync(`netstat -ano | findstr :${DEFAULT_PORT} | findstr LISTENING`, { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'ignore'] });
      const match = output.trim().split(/\s+/).pop();
      return match ? parseInt(match) : null;
    } else {
      // Try lsof first
      try {
        const output = execSync(`lsof -ti:${DEFAULT_PORT}`, { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'ignore'] }).trim();
        if (output) return parseInt(output.split('\n')[0]);
      } catch {}
      // Fallback to ss (common on Linux servers without lsof)
      try {
        const output = execSync(`ss -tlnp sport = :${DEFAULT_PORT}`, { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'ignore'] }).trim();
        const pidMatch = output.match(/pid=(\d+)/);
        if (pidMatch) return parseInt(pidMatch[1]);
      } catch {}
      // Fallback to fuser
      try {
        const output = execSync(`fuser ${DEFAULT_PORT}/tcp 2>/dev/null`, { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'ignore'] }).trim();
        if (output) return parseInt(output.split(/\s+/).pop());
      } catch {}
      return null;
    }
  } catch {
    return null;
  }
}

function isServiceInstalled() {
  if (process.platform === 'darwin') {
    return fs.existsSync(path.join(os.homedir(), 'Library', 'LaunchAgents', `${SERVICE_LABEL}.plist`));
  } else if (process.platform === 'linux') {
    return fs.existsSync(path.join(os.homedir(), '.config', 'systemd', 'user', 'clawalytics.service'));
  } else if (process.platform === 'win32') {
    try {
      execSync(`schtasks /query /tn "${TASK_NAME}" 2>nul`, { stdio: 'ignore' });
      return true;
    } catch { return false; }
  }
  return false;
}

function getUptime(pid) {
  try {
    if (process.platform === 'linux') {
      const stat = fs.readFileSync(`/proc/${pid}/stat`, 'utf-8');
      const startTicks = parseInt(stat.split(' ')[21]);
      const uptimeSecs = parseFloat(fs.readFileSync('/proc/uptime', 'utf-8').split(' ')[0]);
      const hz = 100;
      const processAge = uptimeSecs - (startTicks / hz);
      return formatDuration(processAge);
    } else if (process.platform === 'darwin') {
      const result = execSync(`ps -p ${pid} -o etime=`, { encoding: 'utf-8' }).trim();
      return result;
    }
  } catch {}
  return null;
}

function formatDuration(seconds) {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function formatBytes(bytes) {
  if (bytes >= 1e9) return `${(bytes / 1e9).toFixed(1)} GB`;
  if (bytes >= 1e6) return `${(bytes / 1e6).toFixed(1)} MB`;
  if (bytes >= 1e3) return `${(bytes / 1e3).toFixed(1)} KB`;
  return `${bytes} B`;
}

function getDbSize() {
  try {
    const dbPath = path.join(CONFIG_DIR, 'clawalytics.db');
    if (fs.existsSync(dbPath)) {
      return formatBytes(fs.statSync(dbPath).size);
    }
  } catch {}
  return null;
}

function printTunnelInfo(port) {
  const hostname = os.hostname();
  const user = os.userInfo().username;
  const ips = getServerIPs();
  const ip = ips[0] || 'YOUR_SERVER_IP';

  console.log('');
  console.log('  Remote access via SSH tunnel:');
  console.log('  ─────────────────────────────────────────────────');
  console.log(`  Run this on your local machine:`);
  console.log('');
  console.log(`    ssh -L ${port}:localhost:${port} ${user}@${ip}`);
  console.log('');
  console.log(`  Then open http://localhost:${port} in your browser.`);
  console.log('  ─────────────────────────────────────────────────');
  console.log(`  Hostname:   ${hostname}`);
  if (ips.length > 0) {
    console.log(`  Server IPs: ${ips.join(', ')}`);
  }
  console.log('');
}

async function fetchStats(port) {
  try {
    const response = await fetch(`http://localhost:${port}/api/stats`);
    if (!response.ok) return null;
    return await response.json();
  } catch { return null; }
}

async function fetchEnhanced(port) {
  try {
    const response = await fetch(`http://localhost:${port}/api/stats/enhanced`);
    if (!response.ok) return null;
    return await response.json();
  } catch { return null; }
}

async function fetchBudget(port) {
  try {
    const response = await fetch(`http://localhost:${port}/api/stats/budget`);
    if (!response.ok) return null;
    return await response.json();
  } catch { return null; }
}

function progressBar(percent, width = 15) {
  const clamped = Math.min(100, Math.max(0, percent));
  const filled = Math.round((clamped / 100) * width);
  const empty = width - filled;
  const color = clamped >= 90 ? '\x1b[31m' : clamped >= 70 ? '\x1b[33m' : '\x1b[32m';
  const reset = '\x1b[0m';
  return `${color}${'█'.repeat(filled)}${'░'.repeat(empty)}${reset} ${clamped.toFixed(0)}%`;
}

// ============================================
// Default command (no args) — mini dashboard
// ============================================

if (process.argv.length <= 2 || (process.argv.length === 3 && ['-h', '--help'].includes(process.argv[2]))) {
  if (process.argv.length <= 2) {
    const port = DEFAULT_PORT;
    const pid = getRunningPid();
    const serviceOk = isServiceInstalled();

    console.log('');
    console.log('  🦞 Clawalytics v' + packageJson.version);
    console.log('  ══════════════════════════════════════════════');

    if (!pid) {
      console.log('  Status:  Not running');
      console.log(`  Service: ${serviceOk ? 'Installed (not responding yet)' : 'Not installed'}`);
      console.log('  ──────────────────────────────────────────────');
      console.log('');
      if (!serviceOk) {
        console.log('  Install the service to auto-start on boot:');
        console.log('    clawalytics install-service');
      } else {
        console.log('  The service is installed but not responding.');
        console.log('  Check logs: clawalytics logs');
        console.log('  Reinstall:  npm i -g clawalytics');
      }
      console.log('');
      console.log('  All commands:');
      console.log('    clawalytics --help');
      console.log('');
      process.exit(0);
    }

    console.log(`  Status:  Running (PID ${pid})`);
    console.log(`  Service: ${serviceOk ? 'Installed' : 'Not installed'}`);
    const uptime = getUptime(pid);
    if (uptime) console.log(`  Uptime:  ${uptime}`);
    const dbSize = getDbSize();
    if (dbSize) console.log(`  DB Size: ${dbSize}`);
    console.log(`  Dashboard: http://localhost:${port}`);
    console.log('  ──────────────────────────────────────────────');

    const [stats, enhanced, budget] = await Promise.all([
      fetchStats(port),
      fetchEnhanced(port),
      fetchBudget(port),
    ]);

    if (stats) {
      console.log('');
      console.log('  Spending');
      console.log(`    Today:     $${stats.todaySpend.toFixed(4)}`);
      console.log(`    This week: $${stats.weeklySpend.toFixed(4)}`);
      console.log(`    This month:$${stats.monthlySpend.toFixed(4)}`);
    }

    if (enhanced) {
      console.log('');
      console.log('  Usage');
      console.log(`    Total cost:    $${enhanced.totalCost.toFixed(4)}`);
      console.log(`    Sessions:      ${enhanced.activeSessionsThisMonth} this month`);
      console.log(`    Cache savings: $${enhanced.cacheSavings.toFixed(4)}`);
      console.log(`    Tokens:        ${(enhanced.totalTokens.input / 1000).toFixed(0)}K in / ${(enhanced.totalTokens.output / 1000).toFixed(0)}K out`);
    }

    if (budget && (budget.daily || budget.weekly || budget.monthly)) {
      console.log('');
      console.log('  Budget');
      if (budget.daily) {
        const bar = progressBar(budget.daily.percent);
        console.log(`    Daily:   ${bar} $${budget.daily.spent.toFixed(2)} / $${budget.daily.budget.toFixed(2)}`);
      }
      if (budget.weekly) {
        const bar = progressBar(budget.weekly.percent);
        console.log(`    Weekly:  ${bar} $${budget.weekly.spent.toFixed(2)} / $${budget.weekly.budget.toFixed(2)}`);
      }
      if (budget.monthly) {
        const bar = progressBar(budget.monthly.percent);
        console.log(`    Monthly: ${bar} $${budget.monthly.spent.toFixed(2)} / $${budget.monthly.budget.toFixed(2)}`);
      }
    }

    printTunnelInfo(port);

    console.log('  Commands:');
    console.log('    clawalytics status    Full status & stats');
    console.log('    clawalytics logs -f   Follow server logs');
    console.log('    clawalytics tunnel    SSH tunnel instructions');
    console.log('    clawalytics --help    All commands');
    console.log('');
    process.exit(0);
  }
}

// ============================================
// Commander setup
// ============================================

program
  .name('clawalytics')
  .description(`🦞 Clawalytics v${packageJson.version} — Track your AI spending

  Clawalytics runs as a background service that starts on boot.
  Just install it and it's always running.

    npm i -g clawalytics       Install & auto-start
    clawalytics                 Mini dashboard
    clawalytics status          Full status & stats
    clawalytics logs -f         Follow server logs

  Run \`clawalytics\` with no args for a mini dashboard.`)
  .version(packageJson.version);

// ============================================
// start (foreground only — for development)
// ============================================

program
  .command('start')
  .description('Start Clawalytics in foreground (for development/debugging)')
  .option('-p, --port <port>', 'Port to run the server on', DEFAULT_PORT)
  .action(async (options) => {
    const port = parseInt(options.port);
    const serverPath = path.join(__dirname, '../dist/server/index.js');

    if (!fs.existsSync(serverPath)) {
      console.error('Error: Server not built. Please run `pnpm build` first.');
      process.exit(1);
    }

    const existingPid = getRunningPid();
    if (existingPid) {
      console.log(`🦞 Clawalytics is already running on port ${port} (PID ${existingPid})`);
      console.log(`   If this is the background service, unload it first:`);
      console.log(`   clawalytics uninstall-service`);
      return;
    }

    console.log('🦞 Starting Clawalytics (foreground)...\n');

    const server = spawn('node', [serverPath], {
      env: { ...process.env, PORT: port.toString(), NODE_ENV: 'production' },
      stdio: 'inherit',
    });

    server.on('error', (err) => {
      console.error('Failed to start server:', err);
      process.exit(1);
    });

    server.on('exit', (code) => {
      process.exit(code || 0);
    });
  });

// ============================================
// status
// ============================================

program
  .command('status')
  .description('Show server status, spending stats, and usage')
  .option('-p, --port <port>', 'Port where the server is running', DEFAULT_PORT)
  .action(async (options) => {
    const pid = getRunningPid();
    const port = options.port;
    const serviceOk = isServiceInstalled();

    console.log('');
    console.log('  🦞 Clawalytics Status');
    console.log('  ══════════════════════════════════════════════');

    if (!pid) {
      console.log('  Server:  Not running');
      console.log(`  Service: ${serviceOk ? 'Installed (not responding)' : 'Not installed'}`);
      console.log('  ──────────────────────────────────────────────');
      console.log('');
      if (!serviceOk) {
        console.log('  Run: clawalytics install-service');
      } else {
        console.log('  Check logs: clawalytics logs');
      }
      console.log('');
      return;
    }

    console.log(`  Server:    Running (PID ${pid})`);
    console.log(`  Service:   ${serviceOk ? 'Installed' : 'Not installed'}`);
    const uptime = getUptime(pid);
    if (uptime) console.log(`  Uptime:    ${uptime}`);
    console.log(`  Dashboard: http://localhost:${port}`);
    const dbSize = getDbSize();
    if (dbSize) console.log(`  DB Size:   ${dbSize}`);
    console.log('  ──────────────────────────────────────────────');

    const [stats, enhanced, budget] = await Promise.all([
      fetchStats(port),
      fetchEnhanced(port),
      fetchBudget(port),
    ]);

    if (stats) {
      console.log('');
      console.log('  Spending');
      console.log('  ──────────────────────────────────────────────');
      console.log(`  Today:       $${stats.todaySpend.toFixed(4)}`);
      console.log(`  This week:   $${stats.weeklySpend.toFixed(4)}`);
      console.log(`  This month:  $${stats.monthlySpend.toFixed(4)}`);
      console.log(`  Sessions:    ${stats.totalSessions}`);
    }

    if (enhanced) {
      console.log('');
      console.log('  Usage');
      console.log('  ──────────────────────────────────────────────');
      console.log(`  Total cost:      $${enhanced.totalCost.toFixed(4)}`);
      console.log(`  Month sessions:  ${enhanced.activeSessionsThisMonth}`);
      console.log(`  Cache savings:   $${enhanced.cacheSavings.toFixed(4)}`);
      console.log(`  Input tokens:    ${(enhanced.totalTokens.input / 1000).toFixed(0)}K`);
      console.log(`  Output tokens:   ${(enhanced.totalTokens.output / 1000).toFixed(0)}K`);
      if (enhanced.totalTokens.cacheRead > 0) {
        console.log(`  Cache read:      ${(enhanced.totalTokens.cacheRead / 1000).toFixed(0)}K`);
      }
    }

    if (budget && (budget.daily || budget.weekly || budget.monthly)) {
      console.log('');
      console.log('  Budget');
      console.log('  ──────────────────────────────────────────────');
      if (budget.daily) {
        const bar = progressBar(budget.daily.percent);
        console.log(`  Daily:   ${bar}  $${budget.daily.spent.toFixed(2)} / $${budget.daily.budget.toFixed(2)}`);
      }
      if (budget.weekly) {
        const bar = progressBar(budget.weekly.percent);
        console.log(`  Weekly:  ${bar}  $${budget.weekly.spent.toFixed(2)} / $${budget.weekly.budget.toFixed(2)}`);
      }
      if (budget.monthly) {
        const bar = progressBar(budget.monthly.percent);
        console.log(`  Monthly: ${bar}  $${budget.monthly.spent.toFixed(2)} / $${budget.monthly.budget.toFixed(2)}`);
      }
    }

    if (!stats && !enhanced) {
      console.log('');
      console.log('  Could not fetch stats. Server may still be starting up.');
    }

    printTunnelInfo(port);
  });

// ============================================
// update
// ============================================

program
  .command('update')
  .description('Update Clawalytics to the latest version')
  .option('--check', 'Only check for updates, don\'t install')
  .action(async (options) => {
    console.log('');
    console.log('  🦞 Clawalytics Updater');
    console.log('  ══════════════════════════════════════════════');
    console.log(`  Current version: v${packageJson.version}`);

    let latest;
    try {
      const response = await fetch('https://registry.npmjs.org/clawalytics/latest');
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      latest = data.version;
    } catch {
      console.log('  Could not check for updates. Check your internet connection.');
      console.log('');
      console.log('  Manual update:');
      console.log('    npm i -g clawalytics@latest');
      console.log('');
      return;
    }

    console.log(`  Latest version:  v${latest}`);
    console.log('  ──────────────────────────────────────────────');

    if (latest === packageJson.version) {
      console.log('  You\'re already on the latest version!');
      console.log('');
      return;
    }

    if (options.check) {
      console.log(`  Update available: v${packageJson.version} → v${latest}`);
      console.log('');
      console.log('  Run `clawalytics update` to install.');
      console.log('');
      return;
    }

    console.log(`  Updating v${packageJson.version} → v${latest}...`);
    console.log('  (The service will auto-restart with the new version)');
    console.log('');

    const isYarn = process.env.npm_config_user_agent?.includes('yarn');
    const isPnpm = process.env.npm_config_user_agent?.includes('pnpm');
    const cmd = isPnpm ? 'pnpm' : isYarn ? 'yarn' : 'npm';
    const args = cmd === 'npm' ? ['i', '-g', 'clawalytics@latest'] :
                 cmd === 'pnpm' ? ['add', '-g', 'clawalytics@latest'] :
                 ['global', 'add', 'clawalytics@latest'];

    const update = spawn(cmd, args, { stdio: 'inherit' });

    update.on('close', (code) => {
      console.log('');
      if (code === 0) {
        console.log(`  Updated to v${latest}!`);
        console.log('  The service has been reinstalled automatically.');
      } else {
        console.log('  Update failed. Try manually:');
        console.log(`    sudo ${cmd} ${args.join(' ')}`);
      }
      console.log('');
    });

    update.on('error', () => {
      console.log(`  Could not run ${cmd}. Try manually:`);
      console.log('    npm i -g clawalytics@latest');
      console.log('');
    });
  });

// ============================================
// tunnel
// ============================================

program
  .command('tunnel')
  .description('Show SSH tunnel instructions for remote dashboard access')
  .option('-p, --port <port>', 'Port where the server is running', DEFAULT_PORT)
  .action((options) => {
    const port = options.port;
    const hostname = os.hostname();
    const user = os.userInfo().username;
    const ips = getServerIPs();

    console.log('');
    console.log('  🦞 SSH Tunnel Setup');
    console.log('  ══════════════════════════════════════════════');
    console.log('');
    console.log('  Clawalytics binds to localhost only for security.');
    console.log('  Use an SSH tunnel to access the dashboard from');
    console.log('  your local machine.');
    console.log('');
    console.log('  ──────────────────────────────────────────────');
    console.log('  Run this on your LOCAL machine:');
    console.log('  ──────────────────────────────────────────────');
    console.log('');

    if (ips.length > 0) {
      for (const ip of ips) {
        console.log(`    ssh -L ${port}:localhost:${port} ${user}@${ip}`);
      }
    } else {
      console.log(`    ssh -L ${port}:localhost:${port} ${user}@YOUR_SERVER_IP`);
    }

    console.log('');
    console.log('  Then open in your browser:');
    console.log(`    http://localhost:${port}`);
    console.log('');
    console.log('  ──────────────────────────────────────────────');
    console.log('  Keep it running in the background:');
    console.log('  ──────────────────────────────────────────────');
    console.log('');

    if (ips.length > 0) {
      console.log(`    ssh -fNL ${port}:localhost:${port} ${user}@${ips[0]}`);
    } else {
      console.log(`    ssh -fNL ${port}:localhost:${port} ${user}@YOUR_SERVER_IP`);
    }

    console.log('');
    console.log('  This runs the tunnel in the background (-fN).');
    console.log('  To stop it: kill $(lsof -ti:' + port + ')');
    console.log('');
    console.log('  ──────────────────────────────────────────────');
    console.log(`  Server:    ${hostname}`);
    if (ips.length > 0) {
      console.log(`  IPs:       ${ips.join(', ')}`);
    }
    console.log(`  Port:      ${port}`);
    console.log(`  User:      ${user}`);
    console.log('  ──────────────────────────────────────────────');
    console.log('');
  });

// ============================================
// logs
// ============================================

program
  .command('logs')
  .description('View Clawalytics server logs')
  .option('-f, --follow', 'Follow log output (like tail -f)')
  .option('-n, --lines <lines>', 'Number of lines to show', '50')
  .action((options) => {
    if (!fs.existsSync(LOG_FILE)) {
      console.log('No log file found yet. The service may not have started.');
      console.log(`Expected at: ${LOG_FILE}`);
      return;
    }

    if (process.platform === 'win32') {
      // Windows doesn't have tail
      const content = fs.readFileSync(LOG_FILE, 'utf-8');
      const lines = content.split('\n');
      console.log(lines.slice(-parseInt(options.lines)).join('\n'));
      if (options.follow) {
        console.log('\n(--follow is not supported on Windows, showing last lines only)');
      }
      return;
    }

    const args = options.follow
      ? ['-f', LOG_FILE]
      : ['-n', options.lines, LOG_FILE];

    const tail = spawn('tail', args, { stdio: 'inherit' });

    tail.on('error', () => {
      const content = fs.readFileSync(LOG_FILE, 'utf-8');
      const lines = content.split('\n');
      console.log(lines.slice(-parseInt(options.lines)).join('\n'));
    });
  });

// ============================================
// config
// ============================================

program
  .command('config')
  .description('Open the config file in your default editor')
  .action(() => {
    if (!fs.existsSync(CONFIG_FILE)) {
      console.log('Config file not found.');
      console.log(`Config will be created at: ${CONFIG_FILE}`);
      console.log('The service creates it automatically on first run.');
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

// ============================================
// budget
// ============================================

program
  .command('budget')
  .description('Configure budget alert thresholds (daily/weekly/monthly)')
  .option('--daily <amount>', 'Daily budget limit (0 to disable)')
  .option('--weekly <amount>', 'Weekly budget limit (0 to disable)')
  .option('--monthly <amount>', 'Monthly budget limit (0 to disable)')
  .action(async (options) => {
    // Load existing config
    let config = {};
    try {
      if (fs.existsSync(CONFIG_FILE)) {
        const { default: yaml } = await import('yaml');
        config = yaml.parse(fs.readFileSync(CONFIG_FILE, 'utf-8')) || {};
      }
    } catch {}

    const thresholds = config.alertThresholds || { dailyBudget: 10, weeklyBudget: 50, monthlyBudget: 200 };
    const hasFlags = options.daily !== undefined || options.weekly !== undefined || options.monthly !== undefined;

    if (hasFlags) {
      // Non-interactive mode
      if (options.daily !== undefined) thresholds.dailyBudget = parseFloat(options.daily);
      if (options.weekly !== undefined) thresholds.weeklyBudget = parseFloat(options.weekly);
      if (options.monthly !== undefined) thresholds.monthlyBudget = parseFloat(options.monthly);

      config.alertThresholds = thresholds;

      if (!fs.existsSync(CONFIG_DIR)) fs.mkdirSync(CONFIG_DIR, { recursive: true });
      const { default: yaml } = await import('yaml');
      fs.writeFileSync(CONFIG_FILE, yaml.stringify(config, { indent: 2 }), 'utf-8');

      console.log('');
      console.log('  Budget updated!');
      console.log(`    Daily:   $${thresholds.dailyBudget.toFixed(2)}`);
      console.log(`    Weekly:  $${thresholds.weeklyBudget.toFixed(2)}`);
      console.log(`    Monthly: $${thresholds.monthlyBudget.toFixed(2)}`);
      console.log('');
    } else {
      // Interactive mode
      const { default: readline } = await import('readline');
      const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
      const ask = (q) => new Promise((resolve) => rl.question(q, resolve));

      console.log('');
      console.log('  Budget Configuration');
      console.log('  ══════════════════════════════════════════════');
      console.log('  Set budget limits. Enter 0 to disable. Press Enter to keep current value.');
      console.log('');

      const dailyInput = await ask(`  Daily budget  [$${thresholds.dailyBudget.toFixed(2)}]: `);
      const weeklyInput = await ask(`  Weekly budget [$${thresholds.weeklyBudget.toFixed(2)}]: `);
      const monthlyInput = await ask(`  Monthly budget [$${thresholds.monthlyBudget.toFixed(2)}]: `);

      rl.close();

      const oldDaily = thresholds.dailyBudget;
      const oldWeekly = thresholds.weeklyBudget;
      const oldMonthly = thresholds.monthlyBudget;

      if (dailyInput.trim()) thresholds.dailyBudget = parseFloat(dailyInput);
      if (weeklyInput.trim()) thresholds.weeklyBudget = parseFloat(weeklyInput);
      if (monthlyInput.trim()) thresholds.monthlyBudget = parseFloat(monthlyInput);

      config.alertThresholds = thresholds;

      if (!fs.existsSync(CONFIG_DIR)) fs.mkdirSync(CONFIG_DIR, { recursive: true });
      const { default: yaml } = await import('yaml');
      fs.writeFileSync(CONFIG_FILE, yaml.stringify(config, { indent: 2 }), 'utf-8');

      console.log('');
      console.log('  Budget updated!');
      const tag = (old, cur) => old === cur ? '  (unchanged)' : '';
      console.log(`    Daily:   $${thresholds.dailyBudget.toFixed(2)}${tag(oldDaily, thresholds.dailyBudget)}`);
      console.log(`    Weekly:  $${thresholds.weeklyBudget.toFixed(2)}${tag(oldWeekly, thresholds.weeklyBudget)}`);
      console.log(`    Monthly: $${thresholds.monthlyBudget.toFixed(2)}${tag(oldMonthly, thresholds.monthlyBudget)}`);
      console.log('');
    }

    // Try to notify running server
    try {
      await fetch(`http://localhost:${DEFAULT_PORT}/api/config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ alertThresholds: thresholds }),
      });
    } catch {}
  });

// ============================================
// path
// ============================================

program
  .command('path')
  .description('Show paths to config, database, and log files')
  .action(() => {
    const serviceOk = isServiceInstalled();
    let servicePath = 'Not installed';
    if (process.platform === 'darwin') {
      servicePath = path.join(os.homedir(), 'Library', 'LaunchAgents', `${SERVICE_LABEL}.plist`);
    } else if (process.platform === 'linux') {
      servicePath = path.join(os.homedir(), '.config', 'systemd', 'user', 'clawalytics.service');
    } else if (process.platform === 'win32') {
      servicePath = `Task Scheduler: ${TASK_NAME}`;
    }

    console.log('');
    console.log('  🦞 Clawalytics Paths');
    console.log('  ══════════════════════════════════════════════');
    console.log(`  Config:    ${CONFIG_FILE}`);
    console.log(`  Database:  ${path.join(CONFIG_DIR, 'clawalytics.db')}`);
    console.log(`  Logs:      ${LOG_FILE}`);
    console.log(`  Data Dir:  ${CONFIG_DIR}`);
    console.log(`  Service:   ${serviceOk ? servicePath : 'Not installed'}`);
    console.log('  ══════════════════════════════════════════════');
    console.log('');
  });

// ============================================
// install-service (cross-platform, manual)
// ============================================

program
  .command('install-service')
  .description('Manually install the auto-start service (normally done automatically on npm install)')
  .option('-p, --port <port>', 'Port to run the server on', DEFAULT_PORT)
  .action((options) => {
    const port = options.port;
    const nodePath = process.execPath;
    const serverPath = path.resolve(__dirname, '../dist/server/index.js');

    if (!fs.existsSync(serverPath)) {
      console.error('Error: Server not built. Please run `pnpm build` first.');
      process.exit(1);
    }

    if (!fs.existsSync(CONFIG_DIR)) {
      fs.mkdirSync(CONFIG_DIR, { recursive: true });
    }

    try {
      if (process.platform === 'darwin') {
        const agentDir = path.join(os.homedir(), 'Library', 'LaunchAgents');
        const plistPath = path.join(agentDir, `${SERVICE_LABEL}.plist`);

        if (!fs.existsSync(agentDir)) {
          fs.mkdirSync(agentDir, { recursive: true });
        }

        try { execSync(`launchctl unload "${plistPath}" 2>/dev/null`, { stdio: 'ignore' }); } catch {}

        const plist = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>${SERVICE_LABEL}</string>
    <key>ProgramArguments</key>
    <array>
        <string>${nodePath}</string>
        <string>${serverPath}</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>StandardOutPath</key>
    <string>${LOG_FILE}</string>
    <key>StandardErrorPath</key>
    <string>${LOG_FILE}</string>
    <key>EnvironmentVariables</key>
    <dict>
        <key>NODE_ENV</key>
        <string>production</string>
        <key>PORT</key>
        <string>${port}</string>
    </dict>
</dict>
</plist>
`;
        fs.writeFileSync(plistPath, plist);
        execSync(`launchctl load "${plistPath}"`);
        console.log(`🦞 Service installed (LaunchAgent)`);
        console.log(`   Plist: ${plistPath}`);

      } else if (process.platform === 'linux') {
        const serviceDir = path.join(os.homedir(), '.config', 'systemd', 'user');
        const svcPath = path.join(serviceDir, 'clawalytics.service');

        if (!fs.existsSync(serviceDir)) {
          fs.mkdirSync(serviceDir, { recursive: true });
        }

        const serviceContent = `[Unit]
Description=Clawalytics - AI Cost Analytics Dashboard
After=network.target

[Service]
Type=simple
Environment=NODE_ENV=production
Environment=PORT=${port}
ExecStart=${nodePath} ${serverPath}
Restart=always
RestartSec=5
StandardOutput=append:${LOG_FILE}
StandardError=append:${LOG_FILE}

[Install]
WantedBy=default.target
`;
        fs.writeFileSync(svcPath, serviceContent);
        execSync('systemctl --user daemon-reload');
        execSync('systemctl --user enable --now clawalytics');
        console.log(`🦞 Service installed (systemd user service)`);
        console.log(`   Service: ${svcPath}`);

      } else if (process.platform === 'win32') {
        try { execSync(`schtasks /delete /tn "${TASK_NAME}" /f 2>nul`, { stdio: 'ignore' }); } catch {}
        execSync(`schtasks /create /tn "${TASK_NAME}" /tr "\\"${nodePath}\\" \\"${serverPath}\\"" /sc onlogon /rl limited /f`);
        try { execSync(`schtasks /run /tn "${TASK_NAME}"`, { stdio: 'ignore' }); } catch {}
        console.log(`🦞 Service installed (Task Scheduler)`);

      } else {
        console.log(`Unsupported platform: ${process.platform}`);
        return;
      }

      console.log(`   Dashboard: http://localhost:${port}`);
      console.log(`   Logs:      ${LOG_FILE}`);
    } catch (err) {
      console.error(`Failed to install service: ${err.message}`);
    }
  });

// ============================================
// uninstall-service (cross-platform)
// ============================================

program
  .command('uninstall-service')
  .description('Remove the auto-start service')
  .action(() => {
    try {
      if (process.platform === 'darwin') {
        const plistPath = path.join(os.homedir(), 'Library', 'LaunchAgents', `${SERVICE_LABEL}.plist`);
        if (!fs.existsSync(plistPath)) {
          console.log('🦞 No service found. Nothing to uninstall.');
          return;
        }
        try { execSync(`launchctl unload "${plistPath}" 2>/dev/null`, { stdio: 'ignore' }); } catch {}
        fs.unlinkSync(plistPath);
        console.log('🦞 Service uninstalled (LaunchAgent removed)');

      } else if (process.platform === 'linux') {
        const svcPath = path.join(os.homedir(), '.config', 'systemd', 'user', 'clawalytics.service');
        if (!fs.existsSync(svcPath)) {
          console.log('🦞 No service found. Nothing to uninstall.');
          return;
        }
        try { execSync('systemctl --user disable --now clawalytics 2>/dev/null', { stdio: 'ignore' }); } catch {}
        fs.unlinkSync(svcPath);
        try { execSync('systemctl --user daemon-reload', { stdio: 'ignore' }); } catch {}
        console.log('🦞 Service uninstalled (systemd service removed)');

      } else if (process.platform === 'win32') {
        try {
          execSync(`schtasks /delete /tn "${TASK_NAME}" /f`, { stdio: 'ignore' });
          console.log('🦞 Service uninstalled (Task Scheduler entry removed)');
        } catch {
          console.log('🦞 No service found. Nothing to uninstall.');
          return;
        }

      } else {
        console.log(`Unsupported platform: ${process.platform}`);
        return;
      }

      console.log('   Clawalytics will no longer auto-start on boot.');
      console.log('   Reinstall with: npm i -g clawalytics');
    } catch (err) {
      console.error(`Failed to uninstall service: ${err.message}`);
    }
  });

// ============================================
// mcp
// ============================================

program
  .command('mcp')
  .description('Start the MCP server (stdio transport) for AI tool integration')
  .action(async () => {
    const mcpPath = path.join(__dirname, '../dist/server/mcp/index.js');

    if (!fs.existsSync(mcpPath)) {
      console.error('Error: MCP server not built. Please run `pnpm build` first.');
      process.exit(1);
    }

    const { startMcpServer } = await import(mcpPath);
    await startMcpServer();
  });

program.parse();
