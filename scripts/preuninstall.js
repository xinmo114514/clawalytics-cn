#!/usr/bin/env node

/**
 * preuninstall script — removes the clawalytics OS service
 * when the user runs `npm uninstall -g clawalytics`.
 */

import { execSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

const SERVICE_LABEL = 'com.clawalytics.dashboard';
const TASK_NAME = 'Clawalytics';
const HOME = os.homedir();
const CONFIG_DIR = path.join(HOME, '.clawalytics');

// ─────────────────────────────────────────────
// macOS — LaunchAgent
// ─────────────────────────────────────────────

function uninstallMacOS() {
  const plistPath = path.join(HOME, 'Library', 'LaunchAgents', `${SERVICE_LABEL}.plist`);

  if (!fs.existsSync(plistPath)) return;

  try {
    execSync(`launchctl unload "${plistPath}" 2>/dev/null`, { stdio: 'ignore' });
  } catch {}

  fs.unlinkSync(plistPath);
  console.log('  Clawalytics service removed (LaunchAgent)');
}

// ─────────────────────────────────────────────
// Linux — systemd user service
// ─────────────────────────────────────────────

function uninstallLinux() {
  const servicePath = path.join(HOME, '.config', 'systemd', 'user', 'clawalytics.service');

  if (!fs.existsSync(servicePath)) return;

  try {
    execSync('systemctl --user disable --now clawalytics 2>/dev/null', { stdio: 'ignore' });
  } catch {}

  fs.unlinkSync(servicePath);

  try {
    execSync('systemctl --user daemon-reload', { stdio: 'ignore' });
  } catch {}

  console.log('  Clawalytics service removed (systemd)');
}

// ─────────────────────────────────────────────
// Windows — Task Scheduler
// ─────────────────────────────────────────────

function uninstallWindows() {
  try {
    execSync(`schtasks /delete /tn "${TASK_NAME}" /f 2>nul`, { stdio: 'ignore' });
    console.log('  Clawalytics service removed (Task Scheduler)');
  } catch {}
}

// ─────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────

try {
  // Clean up PID file if it exists
  const pidFile = path.join(CONFIG_DIR, 'clawalytics.pid');
  try {
    if (fs.existsSync(pidFile)) {
      const pid = parseInt(fs.readFileSync(pidFile, 'utf-8').trim());
      try { process.kill(pid, 'SIGTERM'); } catch {}
      fs.unlinkSync(pidFile);
    }
  } catch {}

  const platform = process.platform;

  if (platform === 'darwin') {
    uninstallMacOS();
  } else if (platform === 'linux') {
    uninstallLinux();
  } else if (platform === 'win32') {
    uninstallWindows();
  }
} catch (err) {
  // Never fail the uninstall
  console.log(`  Could not remove Clawalytics service: ${err.message}`);
  console.log(`  You can remove it manually: clawalytics uninstall-service`);
}
