#!/usr/bin/env node

/**
 * postinstall script — automatically installs clawalytics as an OS-level service
 * so it starts on boot and stays running forever.
 *
 * macOS:   LaunchAgent plist
 * Linux:   systemd user service
 * Windows: Task Scheduler
 */

import { execSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SERVICE_LABEL = 'com.clawalytics.dashboard';
const TASK_NAME = 'Clawalytics';
const HOME = os.homedir();
const CONFIG_DIR = path.join(HOME, '.clawalytics');
const LOG_FILE = path.join(CONFIG_DIR, 'clawalytics.log');
const NODE_PATH = process.execPath;
const SERVER_PATH = path.resolve(__dirname, '../dist/server/index.js');
const PORT = '9174';

// Ensure config dir exists (needed for log file paths)
if (!fs.existsSync(CONFIG_DIR)) {
  fs.mkdirSync(CONFIG_DIR, { recursive: true });
}

function killExistingProcess() {
  // Clean up any old PID-based process before installing the service
  const pidFile = path.join(CONFIG_DIR, 'clawalytics.pid');
  try {
    if (fs.existsSync(pidFile)) {
      const pid = parseInt(fs.readFileSync(pidFile, 'utf-8').trim());
      try {
        process.kill(pid, 'SIGTERM');
      } catch {}
      fs.unlinkSync(pidFile);
    }
  } catch {}
}

// ─────────────────────────────────────────────
// macOS — LaunchAgent
// ─────────────────────────────────────────────

function installMacOS() {
  const agentDir = path.join(HOME, 'Library', 'LaunchAgents');
  const plistPath = path.join(agentDir, `${SERVICE_LABEL}.plist`);

  if (!fs.existsSync(agentDir)) {
    fs.mkdirSync(agentDir, { recursive: true });
  }

  // Unload existing service if present (ignore errors)
  try {
    execSync(`launchctl unload "${plistPath}" 2>/dev/null`, { stdio: 'ignore' });
  } catch {}

  const plist = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>${SERVICE_LABEL}</string>
    <key>ProgramArguments</key>
    <array>
        <string>${NODE_PATH}</string>
        <string>${SERVER_PATH}</string>
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
        <string>${PORT}</string>
    </dict>
</dict>
</plist>
`;

  fs.writeFileSync(plistPath, plist);
  execSync(`launchctl load "${plistPath}"`);

  console.log(`  Clawalytics service installed (LaunchAgent)`);
  console.log(`  Dashboard: http://localhost:${PORT}`);
}

// ─────────────────────────────────────────────
// Linux — systemd user service
// ─────────────────────────────────────────────

function installLinux() {
  const serviceDir = path.join(HOME, '.config', 'systemd', 'user');
  const servicePath = path.join(serviceDir, 'clawalytics.service');

  if (!fs.existsSync(serviceDir)) {
    fs.mkdirSync(serviceDir, { recursive: true });
  }

  const serviceContent = `[Unit]
Description=Clawalytics - AI Cost Analytics Dashboard
After=network.target

[Service]
Type=simple
Environment=NODE_ENV=production
Environment=PORT=${PORT}
ExecStart=${NODE_PATH} ${SERVER_PATH}
Restart=always
RestartSec=5
StandardOutput=append:${LOG_FILE}
StandardError=append:${LOG_FILE}

[Install]
WantedBy=default.target
`;

  fs.writeFileSync(servicePath, serviceContent);
  execSync('systemctl --user daemon-reload');
  execSync('systemctl --user enable --now clawalytics');

  console.log(`  Clawalytics service installed (systemd user service)`);
  console.log(`  Dashboard: http://localhost:${PORT}`);
}

// ─────────────────────────────────────────────
// Windows — Task Scheduler
// ─────────────────────────────────────────────

function installWindows() {
  // Delete existing task if present (ignore errors)
  try {
    execSync(`schtasks /delete /tn "${TASK_NAME}" /f 2>nul`, { stdio: 'ignore' });
  } catch {}

  const cmd = `schtasks /create /tn "${TASK_NAME}" /tr "\\"${NODE_PATH}\\" \\"${SERVER_PATH}\\"" /sc onlogon /rl limited /f`;
  execSync(cmd);

  // Also start it right now
  try {
    execSync(`schtasks /run /tn "${TASK_NAME}"`, { stdio: 'ignore' });
  } catch {}

  console.log(`  Clawalytics service installed (Task Scheduler)`);
  console.log(`  Dashboard: http://localhost:${PORT}`);
}

// ─────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────

try {
  killExistingProcess();

  const platform = process.platform;

  if (platform === 'darwin') {
    installMacOS();
  } else if (platform === 'linux') {
    installLinux();
  } else if (platform === 'win32') {
    installWindows();
  } else {
    console.log(`  Unsupported platform: ${platform}`);
    console.log(`  Start manually: clawalytics start --foreground`);
  }
  // Show budget setup hint
  console.log('');
  console.log('  Configure budget alerts:');
  console.log('    clawalytics budget');

} catch (err) {
  // Never fail the npm install — just print a message
  console.log('');
  console.log(`  Could not auto-install Clawalytics service: ${err.message}`);
  console.log(`  You can install it manually: clawalytics install-service`);
  console.log('');
}
