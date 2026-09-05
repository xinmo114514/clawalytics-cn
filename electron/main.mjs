import {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  Menu,
  nativeImage,
  Notification,
  shell,
  session,
  systemPreferences,
  Tray,
  utilityProcess,
} from 'electron';
import { execFile } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import WebSocket from 'ws';
import { teardownSocket } from './costs-socket-teardown.mjs';
import {
  isAllowedAppNavigation,
  isAllowedExternalUrl,
} from './navigation-policy.mjs';
import {
  NOTIFICATION_SOURCES,
  buildNotification,
  createEmptyStats,
  normalizeStats,
} from './notification-stats.mjs';

const isMac = process.platform === 'darwin';
const isWindows = process.platform === 'win32';
const APP_ID = 'com.clawalytics.desktop';
const COSTS_WS_RECONNECT_MS = 5000;
const FORCE_QUIT_TIMEOUT_MS = 5000;
// The backend serves from a cold cache within a couple of seconds, but the
// first scan of a large OpenClaw history (thousands of transcripts, often on
// a WSL/UNC path) can take far longer than that. Failing the launch outright
// is worse than a slow first paint, so allow a generous window.
const BACKEND_READY_TIMEOUT_MS = 60000;
const BACKEND_STOP_TIMEOUT_MS = 2000;
const BACKEND_KILL_GRACE_MS = 1000;
const BACKEND_RESTART_MAX_ATTEMPTS = 3;
const BACKEND_RESTART_RETRY_DELAY_MS = 2000;
const DASHBOARD_LOAD_ATTEMPTS = 3;
const DASHBOARD_LOAD_RETRY_DELAY_MS = 1000;
const RENDERER_CRASH_RELOAD_LIMIT = 3;
const TITLE_BAR_HEIGHT = 48;
const DESKTOP_PREFERENCES_FILE = 'desktop-preferences.json';
const CLOSE_ACTION_ASK = 'ask';
const CLOSE_ACTION_TRAY = 'tray';
const CLOSE_ACTION_QUIT = 'quit';
const STARTUP_MODE_WINDOW = 'window';
const STARTUP_MODE_TRAY = 'tray';
const NOTIFICATION_TRIGGER_ACTIVITY = 'activity';
const NOTIFICATION_TRIGGER_COST = 'cost';
const NOTIFICATION_TRIGGER_TOKENS = 'tokens';
const NOTIFICATION_TRIGGER_BOTH = 'both';
const DEFAULT_NOTIFICATION_DELAY_SECONDS = 30;
const STARTUP_HIDDEN_ARG = '--clawalytics-start-hidden';
const STARTUP_REGISTRY_VALUE_NAME = 'Clawalytics';
const WINDOWS_RUN_REGISTRY_KEY = 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run';
const WINDOWS_STARTUP_APPROVED_RUN_KEY = 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\StartupApproved\\Run';
const WINDOWS_STARTUP_APPROVED_ENABLED = '020000000000000000000000';
const WINDOWS_STARTUP_SHORTCUT_FILE = `${STARTUP_REGISTRY_VALUE_NAME}.lnk`;
const CURRENCY_CNY = 'CNY';
const CURRENCY_USD = 'USD';
const USD_TO_CNY_RATE = 7;
const LOADING_PAGE_HTML = `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <style>
      html,
      body {
        margin: 0;
        width: 100%;
        height: 100%;
        background: #0f172a;
        overflow: hidden;
      }
      body {
        display: flex;
        align-items: center;
        justify-content: center;
        font-family: system-ui, -apple-system, 'Segoe UI', sans-serif;
      }
      .brand {
        color: #e2e8f0;
        font-size: 20px;
        font-weight: 600;
        letter-spacing: 0.02em;
        animation: pulse 1.4s ease-in-out infinite;
      }
      @keyframes pulse {
        0%,
        100% {
          opacity: 1;
        }
        50% {
          opacity: 0.45;
        }
      }
    </style>
  </head>
  <body>
    <div class="brand">Clawalytics</div>
  </body>
</html>`;
const LOADING_PAGE_URL = `data:text/html;charset=utf-8,${encodeURIComponent(
  LOADING_PAGE_HTML
)}`;

let backendModule = null;
let backendChild = null;
let backendStartPromise = null;
let backendPort = null;
let desktopToken = null;
let desktopIntegrationsPort = null;
let isQuitting = false;
let mainWindow = null;
let mainWindowCreationPromise = null;
let tray = null;
let trayHintShown = false;
let costsSocket = null;
let costsReconnectTimer = null;
let pendingCostsNotificationTimer = null;
let latestStatsSnapshot = null;
let lastNotifiedStatsSnapshot = null;
let isRefreshingCostStats = false;
let hasQueuedCostRefresh = false;
let isHandlingCloseChoice = false;
let forceQuitTimer = null;
let backendRestartInFlight = false;
let rendererCrashReloadCount = 0;
let desktopPreferencesLoaded = false;
let desktopPreferences = {
  locale: 'en',
  closeAction: CLOSE_ACTION_ASK,
  launchOnStartup: false,
  startupMode: STARTUP_MODE_WINDOW,
  notificationsEnabled: true,
  notificationTrigger: NOTIFICATION_TRIGGER_ACTIVITY,
  notificationDelaySeconds: DEFAULT_NOTIFICATION_DELAY_SECONDS,
  currency: CURRENCY_CNY,
};

const integerFormatter = new Intl.NumberFormat('en-US');

function formatCurrency(value) {
  const currency = desktopPreferences?.currency ?? CURRENCY_CNY;

  if (currency === CURRENCY_USD) {
    const usdValue = value / USD_TO_CNY_RATE;
    if (usdValue >= 100) return `$${usdValue.toFixed(0)}`;
    if (usdValue >= 10) return `$${usdValue.toFixed(1)}`;
    if (usdValue >= 1) return `$${usdValue.toFixed(2)}`;
    if (usdValue >= 0.01) return `$${usdValue.toFixed(2)}`;
    return `$${usdValue.toFixed(4)}`;
  }

  if (value >= 100) return `¥${value.toFixed(0)}`;
  if (value >= 10) return `¥${value.toFixed(1)}`;
  if (value >= 1) return `¥${value.toFixed(2)}`;
  if (value >= 0.01) return `¥${value.toFixed(2)}`;
  return `¥${value.toFixed(4)}`;
}

function normalizeWindowsAccentColor(hex) {
  if (!hex || typeof hex !== 'string') {
    return null;
  }

  // Electron returns Windows accent colors as RRGGBBAA. Alpha is not useful
  // for the semantic theme tokens, so keep only the opaque RGB channels.
  const cleanHex = hex.replace(/^#/, '');
  if (!/^[0-9A-Fa-f]{6}(?:[0-9A-Fa-f]{2})?$/.test(cleanHex)) {
    return null;
  }

  return `#${cleanHex.slice(0, 6).toLowerCase()}`;
}

function getWindowsAccentColor() {
  if (!isWindows) {
    return null;
  }

  try {
    const accentColorHex = systemPreferences.getAccentColor();
    if (!accentColorHex) {
      return null;
    }

    return normalizeWindowsAccentColor(accentColorHex);
  } catch (error) {
    console.error('Failed to get Windows accent color:', error);
    return null;
  }
}

function setupWindowsAccentColorListener() {
  if (!isWindows) {
    return;
  }

  // The accent-color-changed event is Windows-only (matching the guard above)
  // and replaces the previous 1s getAccentColor polling loop, which kept the
  // main process busy even when idle.
  systemPreferences.on('accent-color-changed', () => {
    const accentColor = getWindowsAccentColor();

    if (accentColor && mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('windows-accent-color-changed', accentColor);
    }
  });
}

function getAppAssetPath(...segments) {
  return path.join(app.getAppPath(), ...segments);
}

function getDesktopPreferencesPath() {
  return path.join(os.homedir(), '.clawalytics', DESKTOP_PREFERENCES_FILE);
}

function getIcon() {
  const iconPath = getAppAssetPath('public', 'images', 'app-icon.ico');
  const icon = nativeImage.createFromPath(iconPath);
  return icon.isEmpty() ? undefined : icon;
}

function formatInteger(value) {
  return integerFormatter.format(Math.round(value));
}

function normalizeLocale(value) {
  return value === 'zh' ? 'zh' : 'en';
}

function normalizeCloseAction(value) {
  if (value === CLOSE_ACTION_TRAY || value === CLOSE_ACTION_QUIT) {
    return value;
  }

  return CLOSE_ACTION_ASK;
}

function normalizeLaunchOnStartup(value) {
  return value === true;
}

function normalizeStartupMode(value) {
  return value === STARTUP_MODE_TRAY ? STARTUP_MODE_TRAY : STARTUP_MODE_WINDOW;
}

function normalizeNotificationsEnabled(value) {
  return value === false ? false : true;
}

function normalizeNotificationTrigger(value) {
  return (
    value === NOTIFICATION_TRIGGER_COST
    || value === NOTIFICATION_TRIGGER_TOKENS
    || value === NOTIFICATION_TRIGGER_BOTH
  )
    ? value
    : NOTIFICATION_TRIGGER_ACTIVITY;
}

function normalizeNotificationDelaySeconds(value) {
  const parsed = typeof value === 'number'
    ? value
    : Number.parseInt(String(value ?? ''), 10);

  if (!Number.isFinite(parsed)) {
    return DEFAULT_NOTIFICATION_DELAY_SECONDS;
  }

  return Math.min(3600, Math.max(5, Math.round(parsed)));
}

function normalizeCurrency(value) {
  return value === CURRENCY_USD ? CURRENCY_USD : CURRENCY_CNY;
}

function normalizeDesktopPreferences(value) {
  return {
    locale: normalizeLocale(value?.locale),
    closeAction: normalizeCloseAction(value?.closeAction),
    launchOnStartup: normalizeLaunchOnStartup(value?.launchOnStartup),
    startupMode: normalizeStartupMode(value?.startupMode),
    notificationsEnabled: normalizeNotificationsEnabled(value?.notificationsEnabled),
    notificationTrigger: normalizeNotificationTrigger(value?.notificationTrigger),
    notificationDelaySeconds: normalizeNotificationDelaySeconds(
      value?.notificationDelaySeconds
    ),
    currency: normalizeCurrency(value?.currency),
  };
}

function getSavedLocale() {
  loadDesktopPreferences();
  return normalizeLocale(desktopPreferences?.locale);
}

function getSavedCloseAction() {
  loadDesktopPreferences();
  return normalizeCloseAction(desktopPreferences?.closeAction);
}

function getSavedLaunchOnStartup() {
  loadDesktopPreferences();
  return normalizeLaunchOnStartup(desktopPreferences?.launchOnStartup);
}

function getSavedStartupMode() {
  loadDesktopPreferences();
  return normalizeStartupMode(desktopPreferences?.startupMode);
}

function getSavedNotificationsEnabled() {
  loadDesktopPreferences();
  return normalizeNotificationsEnabled(desktopPreferences?.notificationsEnabled);
}

function getSavedNotificationTrigger() {
  loadDesktopPreferences();
  return normalizeNotificationTrigger(desktopPreferences?.notificationTrigger);
}

function getSavedNotificationDelaySeconds() {
  loadDesktopPreferences();
  return normalizeNotificationDelaySeconds(desktopPreferences?.notificationDelaySeconds);
}

function translateDesktop(zh, en) {
  return getSavedLocale() === 'zh' ? zh : en;
}

function getCloseActionLabel(action) {
  switch (action) {
    case CLOSE_ACTION_TRAY:
      return translateDesktop('最小化到托盘', 'Minimize to tray');
    case CLOSE_ACTION_QUIT:
      return translateDesktop('退出应用', 'Quit app');
    default:
      return translateDesktop('每次都询问', 'Ask every time');
  }
}

// Preferences are read from disk once and kept in memory; every write goes
// through the cache first and then hits the file (write-through), so tray
// menus and notifications never block the main process on synchronous I/O.
function loadDesktopPreferences(forceRead = false) {
  if (desktopPreferencesLoaded && !forceRead) {
    return;
  }

  desktopPreferencesLoaded = true;

  try {
    const filePath = getDesktopPreferencesPath();

    if (!fs.existsSync(filePath)) {
      desktopPreferences = normalizeDesktopPreferences({});
      return;
    }

    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    desktopPreferences = normalizeDesktopPreferences(parsed);
  } catch (error) {
    console.error('Failed to load desktop preferences:', error);
    desktopPreferences = normalizeDesktopPreferences({});
  }
}

function saveDesktopPreferences() {
  try {
    const filePath = getDesktopPreferencesPath();
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify(desktopPreferences, null, 2), 'utf-8');
  } catch (error) {
    console.error('Failed to save desktop preferences:', error);
  }
}

function setCloseActionPreference(action) {
  desktopPreferences = {
    ...desktopPreferences,
    closeAction: normalizeCloseAction(action),
  };
  saveDesktopPreferences();
  updateTrayMenu();
}

function getStartupLaunchArgs() {
  return getSavedStartupMode() === STARTUP_MODE_TRAY
    ? [STARTUP_HIDDEN_ARG]
    : [];
}

function getWindowsStartupExecutablePath() {
  if (!isWindows) {
    return process.execPath;
  }

  // electron-builder's portable executable starts the app from a temporary
  // unpack directory. Keep the outer portable executable in the startup
  // entry, otherwise the entry points at a path that disappears after exit.
  const portableExecutablePath = process.env.PORTABLE_EXECUTABLE_FILE
    || (
      process.env.PORTABLE_EXECUTABLE_DIR
      && process.env.PORTABLE_EXECUTABLE_APP_FILENAME
        ? path.join(
            process.env.PORTABLE_EXECUTABLE_DIR,
            process.env.PORTABLE_EXECUTABLE_APP_FILENAME
          )
        : null
    );
  if (portableExecutablePath && fs.existsSync(portableExecutablePath)) {
    return path.resolve(portableExecutablePath);
  }

  return process.execPath;
}

function normalizeWindowsPathForCompare(value) {
  return path.resolve(String(value || '')).toLowerCase();
}

function getWindowsStartupFolderPath() {
  const appDataPath = process.env.APPDATA;

  if (!appDataPath) {
    return null;
  }

  return path.join(
    appDataPath,
    'Microsoft',
    'Windows',
    'Start Menu',
    'Programs',
    'Startup'
  );
}

function getWindowsStartupShortcutPath() {
  const startupFolderPath = getWindowsStartupFolderPath();

  if (!startupFolderPath) {
    return null;
  }

  return path.join(startupFolderPath, WINDOWS_STARTUP_SHORTCUT_FILE);
}

function quoteWindowsCommandArgument(value) {
  const escaped = String(value)
    .replace(/(\\*)"/g, '$1$1\\"')
    .replace(/(\\+)$/g, '$1$1');
  return `"${escaped}"`;
}

function getStartupSyncErrorMessage(error) {
  if (!error) {
    return 'unknown error';
  }

  const message = error instanceof Error ? error.message : String(error);
  const stderr = typeof error.stderr === 'string' && error.stderr.trim()
    ? ` stderr: ${error.stderr.trim()}`
    : '';

  return `${message}${stderr}`;
}

function formatStartupSyncErrors(errorsByMechanism) {
  return Object.entries(errorsByMechanism)
    .filter(([, error]) => error)
    .map(([mechanism, error]) => `${mechanism}: ${getStartupSyncErrorMessage(error)}`)
    .join('; ');
}

function runWindowsRegistryCommand(args) {
  return new Promise((resolve, reject) => {
    execFile('reg.exe', args, { windowsHide: true }, (error, stdout, stderr) => {
      if (error) {
        error.stdout = stdout;
        error.stderr = stderr;
        reject(error);
        return;
      }

      resolve({ stdout, stderr });
    });
  });
}

function getWindowsStartupRegistryNames() {
  return Array.from(new Set([
    STARTUP_REGISTRY_VALUE_NAME,
    app.getName(),
    'clawalytics',
  ].filter(Boolean)));
}

async function deleteWindowsRegistryValue(key, name) {
  try {
    await runWindowsRegistryCommand([
      'DELETE',
      key,
      '/v',
      name,
      '/f',
    ]);
  } catch {
    // Missing values are fine when disabling or replacing startup entries.
  }
}

async function setWindowsStartupApproved(openAtLogin, registryNames) {
  if (!isWindows || !app.isPackaged) {
    return;
  }

  if (!openAtLogin) {
    await Promise.all(
      registryNames.map((name) => deleteWindowsRegistryValue(
        WINDOWS_STARTUP_APPROVED_RUN_KEY,
        name
      ))
    );
    return;
  }

  await Promise.all(
    registryNames
      .filter((name) => name !== STARTUP_REGISTRY_VALUE_NAME)
      .map((name) => deleteWindowsRegistryValue(
        WINDOWS_STARTUP_APPROVED_RUN_KEY,
        name
      ))
  );

  await runWindowsRegistryCommand([
    'ADD',
    WINDOWS_STARTUP_APPROVED_RUN_KEY,
    '/v',
    STARTUP_REGISTRY_VALUE_NAME,
    '/t',
    'REG_BINARY',
    '/d',
    WINDOWS_STARTUP_APPROVED_ENABLED,
    '/f',
  ]);
}

async function readWindowsStartupRegistryValue(name) {
  if (!isWindows || !app.isPackaged) {
    return null;
  }

  try {
    const { stdout } = await runWindowsRegistryCommand([
      'QUERY',
      WINDOWS_RUN_REGISTRY_KEY,
      '/v',
      name,
    ]);
    return stdout;
  } catch {
    return null;
  }
}

async function hasExpectedWindowsStartupRegistryValue(args) {
  const stdout = await readWindowsStartupRegistryValue(STARTUP_REGISTRY_VALUE_NAME);

  if (!stdout) {
    return false;
  }

  const normalizedStdout = stdout.toLowerCase();
  const normalizedExecPath = getWindowsStartupExecutablePath().toLowerCase();
  const normalizedHiddenArg = STARTUP_HIDDEN_ARG.toLowerCase();

  return (
    normalizedStdout.includes(normalizedExecPath)
    && (args.length > 0 || !normalizedStdout.includes(normalizedHiddenArg))
    && args.every((arg) => normalizedStdout.includes(String(arg).toLowerCase()))
  );
}

function deleteWindowsStartupShortcut() {
  const shortcutPath = getWindowsStartupShortcutPath();

  if (!shortcutPath || !fs.existsSync(shortcutPath)) {
    return;
  }

  fs.unlinkSync(shortcutPath);
}

function hasExpectedWindowsStartupShortcut(args) {
  if (!isWindows || !app.isPackaged) {
    return false;
  }

  const shortcutPath = getWindowsStartupShortcutPath();

  if (!shortcutPath || !fs.existsSync(shortcutPath)) {
    return false;
  }

  try {
    const shortcut = shell.readShortcutLink(shortcutPath);
    const normalizedTarget = normalizeWindowsPathForCompare(shortcut.target);
    const normalizedExecPath = normalizeWindowsPathForCompare(
      getWindowsStartupExecutablePath()
    );
    const normalizedShortcutArgs = String(shortcut.args || '').toLowerCase();
    const normalizedHiddenArg = STARTUP_HIDDEN_ARG.toLowerCase();

    return (
      normalizedTarget === normalizedExecPath
      && (args.length > 0 || !normalizedShortcutArgs.includes(normalizedHiddenArg))
      && args.every((arg) => normalizedShortcutArgs.includes(String(arg).toLowerCase()))
    );
  } catch (error) {
    console.warn('Failed to read Windows startup shortcut:', error);
    return false;
  }
}

async function writeWindowsStartupShortcut(openAtLogin, args) {
  if (!isWindows || !app.isPackaged) {
    return false;
  }

  const shortcutPath = getWindowsStartupShortcutPath();

  if (!shortcutPath) {
    throw new Error('APPDATA is not available; cannot resolve the Windows Startup folder.');
  }

  if (!openAtLogin) {
    deleteWindowsStartupShortcut();
    return false;
  }

  fs.mkdirSync(path.dirname(shortcutPath), { recursive: true });
  const executablePath = getWindowsStartupExecutablePath();

  const shortcutWritten = shell.writeShortcutLink(shortcutPath, 'replace', {
    target: executablePath,
    args: args.join(' '),
    cwd: path.dirname(executablePath),
    description: 'Start Clawalytics after Windows sign-in',
    appUserModelId: APP_ID,
    icon: executablePath,
    iconIndex: 0,
  });

  if (!shortcutWritten) {
    throw new Error('Electron could not write the Windows Startup folder shortcut.');
  }

  return true;
}

async function writeWindowsStartupRegistry(openAtLogin, args) {
  if (!isWindows || !app.isPackaged) {
    return;
  }

  const registryNames = getWindowsStartupRegistryNames();

  if (!openAtLogin) {
    await Promise.all(
      registryNames.map((name) => deleteWindowsRegistryValue(
        WINDOWS_RUN_REGISTRY_KEY,
        name
      ))
    );
    try {
      await setWindowsStartupApproved(false, registryNames);
    } catch (error) {
      console.warn('Failed to update Windows StartupApproved state:', error);
    }
    return;
  }

  await Promise.all(
    registryNames
      .filter((name) => name !== STARTUP_REGISTRY_VALUE_NAME)
      .map((name) => deleteWindowsRegistryValue(
        WINDOWS_RUN_REGISTRY_KEY,
        name
      ))
  );

  const command = [
    quoteWindowsCommandArgument(getWindowsStartupExecutablePath()),
    ...args.map(quoteWindowsCommandArgument),
  ].join(' ');

  await runWindowsRegistryCommand([
    'ADD',
    WINDOWS_RUN_REGISTRY_KEY,
    '/v',
    STARTUP_REGISTRY_VALUE_NAME,
    '/t',
    'REG_SZ',
    '/d',
    command,
    '/f',
  ]);
  try {
    await setWindowsStartupApproved(true, registryNames);
  } catch (error) {
    console.warn('Failed to update Windows StartupApproved state:', error);
  }
}

async function syncLaunchOnStartupSettings(strict = false) {
  if (!app.isPackaged) {
    return false;
  }

  try {
    const openAtLogin = getSavedLaunchOnStartup();
    const args = getStartupLaunchArgs();
    const startupErrors = {
      electronLoginItem: null,
      runRegistry: null,
      startupShortcut: null,
    };

    try {
      app.setLoginItemSettings({
        name: STARTUP_REGISTRY_VALUE_NAME,
        openAtLogin,
        path: getWindowsStartupExecutablePath(),
        args,
      });
    } catch (error) {
      startupErrors.electronLoginItem = error;
      console.warn('Failed to update Electron login item settings:', error);
    }

    try {
      await writeWindowsStartupRegistry(openAtLogin, args);
    } catch (error) {
      startupErrors.runRegistry = error;
      console.warn('Failed to update Windows Run startup registry:', error);
    }

    let loginItemSettings = { openAtLogin: false };
    try {
      loginItemSettings = app.getLoginItemSettings({
        name: STARTUP_REGISTRY_VALUE_NAME,
        path: getWindowsStartupExecutablePath(),
        args,
      });
    } catch (error) {
      startupErrors.electronLoginItem = startupErrors.electronLoginItem ?? error;
      console.warn('Failed to read Electron login item settings:', error);
    }

    let hasStartupRegistryValue = await hasExpectedWindowsStartupRegistryValue(args);
    let hasStartupShortcut = hasExpectedWindowsStartupShortcut(args);

    if (!openAtLogin || loginItemSettings.openAtLogin || hasStartupRegistryValue) {
      // The registry is the primary mechanism. Remove any shortcut left by an
      // older version so Windows does not launch the app twice at sign-in.
      try {
        await writeWindowsStartupShortcut(false, args);
      } catch (error) {
        startupErrors.startupShortcut = error;
        console.warn('Failed to remove the Windows startup shortcut:', error);
      }
      hasStartupShortcut = hasExpectedWindowsStartupShortcut(args);
    } else {
      // Use the Startup folder only when the primary mechanism could not be
      // confirmed. This keeps the fallback useful without creating duplicate
      // launches when both mechanisms are available.
      try {
        await writeWindowsStartupShortcut(true, args);
      } catch (error) {
        startupErrors.startupShortcut = error;
        console.warn('Failed to update Windows startup shortcut:', error);
      }
      hasStartupShortcut = hasExpectedWindowsStartupShortcut(args);
      hasStartupRegistryValue = await hasExpectedWindowsStartupRegistryValue(args);
    }

    if (!openAtLogin) {
      if (loginItemSettings.openAtLogin || hasStartupRegistryValue || hasStartupShortcut) {
        throw new Error(
          'Windows startup entry is still present after disabling launch at startup.'
        );
      }

      return false;
    }

    if (!loginItemSettings.openAtLogin && !hasStartupRegistryValue && !hasStartupShortcut) {
      const details = formatStartupSyncErrors(startupErrors);
      throw new Error(
        details
          ? `Windows did not confirm any launch-at-startup mechanism after saving it. ${details}`
          : 'Windows did not confirm any launch-at-startup mechanism after saving it.'
      );
    }

    return loginItemSettings.openAtLogin || hasStartupRegistryValue || hasStartupShortcut;
  } catch (error) {
    console.error('Failed to sync launch on startup settings:', error);
    if (strict) {
      throw error;
    }
    return false;
  }
}

function shouldStartHidden() {
  return process.argv.includes(STARTUP_HIDDEN_ARG);
}

function focusMainWindow(window = mainWindow) {
  if (!window || window.isDestroyed()) {
    return;
  }

  if (window.isMinimized()) {
    window.restore();
  }

  window.show();
  window.focus();
}

function reportMainWindowOpenError(error) {
  console.error('Failed to open Clawalytics window:', error);
  dialog.showErrorBox(
    'Clawalytics failed to open',
    error instanceof Error ? error.message : String(error)
  );
}

function showMainWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) {
    void ensureMainWindow({ forceShow: true }).catch(reportMainWindowOpenError);
    return;
  }

  focusMainWindow(mainWindow);
}

function showNativeNotification(options) {
  if (!Notification.isSupported()) {
    return;
  }

  const notification = new Notification({
    icon: getIcon(),
    ...options,
  });

  notification.on('click', () => {
    showMainWindow();
  });

  notification.show();
}

function maybeShowTrayHint() {
  if (trayHintShown) {
    return;
  }

  trayHintShown = true;
  showNativeNotification({
    title: translateDesktop('Clawalytics 仍在后台运行', 'Clawalytics is still running'),
    body: translateDesktop(
      '可在系统托盘中重新打开，或右键托盘图标退出。',
      'Open it from the system tray or right-click the tray icon to quit.'
    ),
    silent: true,
  });
}

function hideWindowToTray() {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return;
  }

  mainWindow.hide();
  maybeShowTrayHint();
}

function updateTrayMenu() {
  if (!tray) {
    return;
  }

  const savedCloseAction = getSavedCloseAction();

  tray.setContextMenu(Menu.buildFromTemplate([
    {
      label: translateDesktop('打开 Clawalytics', 'Open Clawalytics'),
      click: () => {
        showMainWindow();
      },
    },
    {
      label: `${translateDesktop('关闭按钮', 'Close button')}: ${getCloseActionLabel(savedCloseAction)}`,
      enabled: false,
    },
    {
      label: translateDesktop('下次关闭时再次询问', 'Ask on close again'),
      enabled: savedCloseAction !== CLOSE_ACTION_ASK,
      click: () => {
        setCloseActionPreference(CLOSE_ACTION_ASK);
      },
    },
    { type: 'separator' },
    {
      label: translateDesktop('退出', 'Quit'),
      click: () => {
        requestAppQuit();
      },
    },
  ]));
}

function createTray() {
  if (tray) {
    return tray;
  }

  const icon = getIcon();
  tray = new Tray(icon ?? nativeImage.createEmpty());
  tray.setToolTip('Clawalytics');
  updateTrayMenu();
  tray.on('click', () => {
    showMainWindow();
  });
  tray.on('double-click', () => {
    showMainWindow();
  });

  return tray;
}

function clearForceQuitTimer() {
  if (!forceQuitTimer) {
    return;
  }

  clearTimeout(forceQuitTimer);
  forceQuitTimer = null;
}

function scheduleForceQuit() {
  clearForceQuitTimer();
  forceQuitTimer = setTimeout(() => {
    app.exit(0);
  }, FORCE_QUIT_TIMEOUT_MS);
}

function requestAppQuit() {
  if (isQuitting) {
    return;
  }

  isQuitting = true;
  scheduleForceQuit();

  for (const window of BrowserWindow.getAllWindows()) {
    if (!window.isDestroyed()) {
      window.destroy();
    }
  }

  void stopBackend().finally(() => {
    clearForceQuitTimer();
    app.exit(0);
  });
}

async function syncDesktopPreferences(nextPreferences) {
  const previousPreferences = desktopPreferences;

  if (nextPreferences) {
    desktopPreferences = normalizeDesktopPreferences(nextPreferences);
  } else {
    loadDesktopPreferences(true);
  }

  const notificationPreferencesChanged = (
    previousPreferences.notificationsEnabled !== desktopPreferences.notificationsEnabled
    || previousPreferences.notificationTrigger !== desktopPreferences.notificationTrigger
    || previousPreferences.notificationDelaySeconds !== desktopPreferences.notificationDelaySeconds
  );

  if (notificationPreferencesChanged) {
    clearPendingCostsNotification();
    if (latestStatsSnapshot) {
      lastNotifiedStatsSnapshot = latestStatsSnapshot;
    }
  }

  try {
    await syncLaunchOnStartupSettings(true);
  } catch (error) {
    desktopPreferences = previousPreferences;
    updateTrayMenu();
    throw error;
  }

  updateTrayMenu();
}

async function handleDesktopCloseChoice(action) {
  isHandlingCloseChoice = false;

  if (action === 'tray') {
    hideWindowToTray();
    return;
  }

  if (action === 'quit') {
    requestAppQuit();
  }
}

function requestDesktopCloseChoice() {
  if (backendChild) {
    backendChild.postMessage({ type: 'requestCloseChoice' });
    return;
  }

  if (!backendModule || typeof backendModule.requestDesktopCloseChoice !== 'function') {
    isHandlingCloseChoice = false;
    hideWindowToTray();
    return;
  }

  backendModule.requestDesktopCloseChoice();
}

function handleMainWindowClose() {
  const savedCloseAction = getSavedCloseAction();

  if (savedCloseAction === CLOSE_ACTION_TRAY) {
    hideWindowToTray();
    return;
  }

  if (savedCloseAction === CLOSE_ACTION_QUIT) {
    requestAppQuit();
    return;
  }

  if (isHandlingCloseChoice) {
    return;
  }

  isHandlingCloseChoice = true;

  requestDesktopCloseChoice();
}

async function fetchEnhancedStats(port, sourceType) {
  const response = await fetch(
    `http://127.0.0.1:${port}/api/stats/enhanced?sourceType=${sourceType}`,
    { headers: { 'X-Clawalytics-Desktop-Token': desktopToken ?? '' } }
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch enhanced stats: ${response.status}`);
  }

  return normalizeStats(await response.json());
}

function replaceSourceSnapshots(target, source) {
  for (const sourceType of NOTIFICATION_SOURCES) {
    target[sourceType] = source[sourceType] ?? createEmptyStats();
  }
}

function showCostsNotification(currentStats) {
  if (!lastNotifiedStatsSnapshot) {
    lastNotifiedStatsSnapshot = { ...currentStats };
    return false;
  }

  const result = buildNotification({
    previousSnapshots: lastNotifiedStatsSnapshot,
    currentSnapshots: currentStats,
    trigger: getSavedNotificationTrigger(),
    enabled: getSavedNotificationsEnabled(),
    translate: translateDesktop,
    formatCurrency,
    formatInteger,
  });

  // A source reload/reset must establish a new baseline immediately. Other
  // sources can still contribute a valid notification in the same refresh.
  for (const source of result.resetSources) {
    lastNotifiedStatsSnapshot[source] = currentStats[source];
  }

  if (!result.notification) {
    if (result.resetSources.length > 0 || !result.sourceKeys.length) {
      replaceSourceSnapshots(lastNotifiedStatsSnapshot, currentStats);
    }
    return false;
  }

  showNativeNotification({
    title: result.notification.title,
    body: result.notification.body,
  });

  lastNotifiedStatsSnapshot = { ...currentStats };
  return true;
}

function clearPendingCostsNotification() {
  if (!pendingCostsNotificationTimer) {
    return;
  }

  clearTimeout(pendingCostsNotificationTimer);
  pendingCostsNotificationTimer = null;
}

function flushPendingCostsNotification() {
  if (!latestStatsSnapshot || !lastNotifiedStatsSnapshot) {
    return;
  }

  showCostsNotification(latestStatsSnapshot);
}

function schedulePendingCostsNotification() {
  if (pendingCostsNotificationTimer || !lastNotifiedStatsSnapshot) {
    return;
  }

  const delay = Math.max(0, getSavedNotificationDelaySeconds() * 1000);

  pendingCostsNotificationTimer = setTimeout(() => {
    pendingCostsNotificationTimer = null;
    flushPendingCostsNotification();
  }, delay);
}

async function refreshDesktopCostStats() {
  if (!backendPort) {
    return;
  }

  if (isRefreshingCostStats) {
    hasQueuedCostRefresh = true;
    return;
  }

  isRefreshingCostStats = true;

  try {
    do {
      hasQueuedCostRefresh = false;
      const sourceStats = Object.fromEntries(
        await Promise.all(
          NOTIFICATION_SOURCES.map(async (source) => [
            source,
            await fetchEnhancedStats(backendPort, source),
          ])
        )
      );

      latestStatsSnapshot = sourceStats;

      if (!lastNotifiedStatsSnapshot) {
        lastNotifiedStatsSnapshot = { ...sourceStats };
        continue;
      }

      if (!getSavedNotificationsEnabled()) {
        clearPendingCostsNotification();
        lastNotifiedStatsSnapshot = { ...sourceStats };
        continue;
      }

      const result = buildNotification({
        previousSnapshots: lastNotifiedStatsSnapshot,
        currentSnapshots: sourceStats,
        trigger: getSavedNotificationTrigger(),
        enabled: true,
        translate: translateDesktop,
        formatCurrency,
        formatInteger,
      });

      if (!result.notification) {
        clearPendingCostsNotification();
        replaceSourceSnapshots(lastNotifiedStatsSnapshot, sourceStats);
        continue;
      }

      schedulePendingCostsNotification();
    } while (hasQueuedCostRefresh);
  } catch (error) {
    console.error('Failed to refresh desktop cost stats:', error);
  } finally {
    isRefreshingCostStats = false;
  }
}

function closeCostsSocket() {
  clearPendingCostsNotification();

  if (costsReconnectTimer) {
    clearTimeout(costsReconnectTimer);
    costsReconnectTimer = null;
  }

  if (costsSocket) {
    teardownSocket(costsSocket);
    costsSocket = null;
  }
}

function scheduleCostsSocketReconnect(port) {
  if (isQuitting || costsReconnectTimer) {
    return;
  }

  costsReconnectTimer = setTimeout(() => {
    costsReconnectTimer = null;
    connectCostsSocket(port);
  }, COSTS_WS_RECONNECT_MS);
}

function connectCostsSocket(port) {
  if (isQuitting) {
    return;
  }

  // A pending reconnect timer captures a stale port (e.g. the backend
  // restarted on a different one); this connection supersedes it.
  if (costsReconnectTimer) {
    clearTimeout(costsReconnectTimer);
    costsReconnectTimer = null;
  }

  if (costsSocket) {
    teardownSocket(costsSocket);
    costsSocket = null;
  }

  const socket = new WebSocket(`ws://127.0.0.1:${port}/ws`, {
    headers: { 'X-Clawalytics-Desktop-Token': desktopToken ?? '' },
  });
  costsSocket = socket;

  socket.on('message', (payload) => {
    try {
      const message = JSON.parse(payload.toString());

      if (message?.type === 'costs:updated') {
        void refreshDesktopCostStats();
      }
    } catch (error) {
      console.error('Failed to parse desktop WebSocket message:', error);
    }
  });

  socket.on('close', () => {
    if (costsSocket === socket) {
      costsSocket = null;
    }

    scheduleCostsSocketReconnect(port);
  });

  socket.on('error', (error) => {
    console.error('Desktop WebSocket connection error:', error);
  });
}

function initializeDesktopIntegrations(port) {
  createTray();

  if (desktopIntegrationsPort !== port || !costsSocket) {
    connectCostsSocket(port);
    desktopIntegrationsPort = port;
  }

  if (!lastNotifiedStatsSnapshot) {
    void refreshDesktopCostStats();
  }
}

function findFreePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();

    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : null;

      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }

        if (!port) {
          reject(new Error('Unable to allocate a local port for Clawalytics.'));
          return;
        }

        resolve(port);
      });
    });
  });
}

// Emergency fallback: run the backend inside the main process exactly like
// the pre-utilityProcess architecture did. Enable with
// CLAWALYTICS_IN_PROCESS=1 only; it freezes the window under load.
async function startBackendInProcess(port, token) {
  const serverEntry = pathToFileURL(
    getAppAssetPath('dist', 'server', 'index.js')
  ).href;

  process.env.NODE_ENV = 'production';
  process.env.ELECTRON = 'true';
  process.env.PORT = String(port);

  backendModule = await import(serverEntry);

  if (typeof backendModule.start !== 'function') {
    throw new Error('Desktop backend entry does not export a start() function.');
  }

  await backendModule.start({
    port,
    runtimeMode: 'electron',
    desktopToken: token,
  });
  if (typeof backendModule.setDesktopBridge === 'function') {
    backendModule.setDesktopBridge({
      handleCloseChoice: (action) => handleDesktopCloseChoice(action),
      syncPreferences: (preferences) => syncDesktopPreferences(preferences),
    });
  }
}

function startBackendChild(port, token) {
  const child = utilityProcess.fork(
    getAppAssetPath('dist', 'server', 'electron-child.js'),
    [],
    {
      serviceName: 'clawalytics-backend',
      env: {
        ...process.env,
        NODE_ENV: 'production',
        ELECTRON: 'true',
        PORT: String(port),
      },
      // Capture the child's stderr so startup failures aren't silently
      // dropped — the parent process has no other way to see them when the
      // child crashes before it can post a startError IPC message.
      stdio: 'pipe',
    }
  );

  backendChild = child;

  let childStderr = '';
  let childStdout = '';
  if (child.stderr) {
    child.stderr.setEncoding('utf8');
    child.stderr.on('data', (chunk) => {
      childStderr += chunk;
      if (childStderr.length > 32 * 1024) {
        childStderr = childStderr.slice(-32 * 1024);
      }
    });
  }
  if (child.stdout) {
    child.stdout.setEncoding('utf8');
    child.stdout.on('data', (chunk) => {
      childStdout += chunk;
      if (childStdout.length > 32 * 1024) {
        childStdout = childStdout.slice(-32 * 1024);
      }
    });
  }

  return new Promise((resolve, reject) => {
    let settled = false;
    let readyTimeout = null;

    const clearReadyTimeout = () => {
      if (readyTimeout) {
        clearTimeout(readyTimeout);
        readyTimeout = null;
      }
    };

    const summarizeChildOutput = () => {
      const trimmed = `${childStdout}\n${childStderr}`.trim();
      if (!trimmed) {
        return '';
      }
      const lines = trimmed.split(/\r?\n/);
      const tail = lines.slice(-40).join('\n');
      return `\n\nBackend child process output:\n${tail}`;
    };

    const onMessage = (message) => {
      if (!message || typeof message !== 'object') {
        return;
      }

      if (message.type === 'ready') {
        if (settled) {
          return;
        }

        settled = true;
        clearReadyTimeout();
        resolve(port);
        return;
      }

      if (message.type === 'startError') {
        if (settled) {
          return;
        }

        settled = true;
        clearReadyTimeout();
        const reason =
          typeof message.reason === 'string' && message.reason.length > 0
            ? message.reason
            : 'Unknown backend startup error';
        const detail = typeof message.stack === 'string' ? message.stack : undefined;
        const wrapped = new Error(
          detail
            ? `Backend child process failed to start: ${reason}\n\n${detail}${summarizeChildOutput()}`
            : `Backend child process failed to start: ${reason}${summarizeChildOutput()}`
        );
        backendChild = null;
        reject(wrapped);
        return;
      }

      if (message.type === 'handleCloseChoice') {
        void handleDesktopCloseChoice(message.action);
        return;
      }

      if (message.type === 'syncPreferences') {
        void syncDesktopPreferences(message.preferences);
      }
    };

    const onExit = (code) => {
      if (!settled) {
        settled = true;
        clearReadyTimeout();
        reject(
          new Error(
            `Backend child process exited (code ${code}) before signaling ready.${summarizeChildOutput()}`
          )
        );
        return;
      }

      if (backendChild === child) {
        backendChild = null;
        backendPort = null;
        desktopIntegrationsPort = null;
        console.error(
          `Backend child process exited unexpectedly (code ${code}).`
        );
        void restartBackendAfterUnexpectedExit();
      }
    };

    child.on('message', onMessage);
    child.on('exit', onExit);

    // Keep the per-process token on the private utility-process channel. It
    // is never persisted, placed in a URL, or written to logs.
    child.postMessage({ type: 'start', port, desktopToken: token });

    readyTimeout = setTimeout(() => {
      if (settled) {
        return;
      }

      settled = true;
      child.off('message', onMessage);
      child.off('exit', onExit);
      backendChild = null;
      child.kill();
      reject(
        new Error(
          `Backend child process did not signal ready within ${
            BACKEND_READY_TIMEOUT_MS / 1000
          }s. This usually means the database, analytics index, or another startup step is taking unusually long.${summarizeChildOutput()}`
        )
      );
    }, BACKEND_READY_TIMEOUT_MS);
  });
}

async function startBackend() {
  if (backendPort && (backendModule || backendChild)) {
    return backendPort;
  }

  if (backendStartPromise) {
    return backendStartPromise;
  }

  backendStartPromise = (async () => {
    const port = await findFreePort();
    const token = randomBytes(32).toString('base64url');
    desktopToken = token;

    try {
      if (process.env.CLAWALYTICS_IN_PROCESS === '1') {
        await startBackendInProcess(port, token);
      } else {
        await startBackendChild(port, token);
      }

      backendPort = port;
      return port;
    } catch (error) {
      backendModule = null;
      backendChild = null;
      desktopToken = null;
      throw error;
    } finally {
      backendStartPromise = null;
    }
  })();

  return backendStartPromise;
}

async function stopBackend() {
  closeCostsSocket();
  latestStatsSnapshot = null;
  lastNotifiedStatsSnapshot = null;
  trayHintShown = false;
  isHandlingCloseChoice = false;

  if (tray) {
    tray.destroy();
    tray = null;
  }

  if (backendChild) {
    const child = backendChild;
    backendChild = null;
    backendPort = null;
    desktopToken = null;
    desktopIntegrationsPort = null;

    await new Promise((resolve) => {
      let settled = false;
      let killTimer = null;

      const finish = () => {
        if (settled) {
          return;
        }

        settled = true;
        if (killTimer) {
          clearTimeout(killTimer);
        }
        resolve();
      };

      child.once('exit', finish);

      killTimer = setTimeout(() => {
        child.kill();
        setTimeout(finish, BACKEND_KILL_GRACE_MS);
      }, BACKEND_STOP_TIMEOUT_MS);

      child.postMessage({ type: 'stop' });
    });

    return;
  }

  if (backendModule && typeof backendModule.clearDesktopBridge === 'function') {
    backendModule.clearDesktopBridge();
  }

  if (!backendModule || typeof backendModule.stop !== 'function') {
    backendModule = null;
    backendPort = null;
    desktopIntegrationsPort = null;
    desktopToken = null;
    return;
  }

  try {
    await backendModule.stop();
  } finally {
    backendModule = null;
    backendPort = null;
    desktopIntegrationsPort = null;
    desktopToken = null;
  }
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function loadDashboard(window, port) {
  await session.defaultSession.cookies.set({
    url: `http://127.0.0.1:${port}`,
    name: 'clawalytics_desktop_token',
    value: desktopToken ?? '',
    httpOnly: true,
    sameSite: 'strict',
  });

  for (let attempt = 1; ; attempt += 1) {
    if (isQuitting || window.isDestroyed()) {
      return;
    }

    try {
      await window.loadURL(`http://127.0.0.1:${port}`);
      rendererCrashReloadCount = 0;
      return;
    } catch (error) {
      // The backend child signals ready slightly before its HTTP server is
      // accepting connections; retry briefly before giving up.
      if (attempt >= DASHBOARD_LOAD_ATTEMPTS) {
        throw error;
      }
      await delay(DASHBOARD_LOAD_RETRY_DELAY_MS);
    }
  }
}

async function restartBackendAfterUnexpectedExit() {
  if (isQuitting || backendRestartInFlight) {
    return;
  }

  backendRestartInFlight = true;
  try {
    let port = null;
    for (let attempt = 1; attempt <= BACKEND_RESTART_MAX_ATTEMPTS; attempt += 1) {
      try {
        port = await startBackend();
        break;
      } catch (error) {
        console.error(`Backend restart attempt ${attempt} failed:`, error);
        if (attempt >= BACKEND_RESTART_MAX_ATTEMPTS) {
          throw error;
        }
        await delay(BACKEND_RESTART_RETRY_DELAY_MS);
      }
    }

    if (!port) {
      return;
    }

    initializeDesktopIntegrations(port);

    const window = mainWindow;
    if (window && !window.isDestroyed()) {
      await loadDashboard(window, port);
    }
  } catch (error) {
    console.error('Backend could not be restarted automatically:', error);
    dialog.showErrorBox(
      'Clawalytics backend stopped',
      'The Clawalytics backend stopped unexpectedly and could not be restarted. '
        + 'Please restart the app.'
    );
  } finally {
    backendRestartInFlight = false;
  }
}

async function createMainWindow(options = {}) {
  const { forceShow = false } = options;
  const startHidden = !forceShow && shouldStartHidden();

  // Fork the backend child process without waiting for it to become ready so
  // the window can appear immediately. The analysis engine no longer runs in
  // the UI process, so even its heaviest startup work cannot freeze the
  // window; a themed loading page covers the time until the port is known.
  const backendReadyPromise = startBackend();

  const preloadPath = getAppAssetPath('electron', 'preload.cjs');

  const window = new BrowserWindow({
    width: 1280,
    height: 720,
    minWidth: 1100,
    minHeight: 720,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: '#0f172a',
    icon: getIcon(),
    title: 'Clawalytics',
    ...(isWindows
      ? {
          titleBarStyle: 'hidden',
          titleBarOverlay: {
            color: '#00000000',
            height: TITLE_BAR_HEIGHT,
          },
          backgroundMaterial: 'mica',
          roundedCorners: true,
        }
      : {}),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false,
      preload: preloadPath,
    },
  });

  window.webContents.setWindowOpenHandler(({ url }) => {
    if (isAllowedExternalUrl(url)) {
      void shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  // Never let Chromium's white error page persist: swap in the themed splash
  // and let the backend watchdog / retry logic drive recovery.
  window.webContents.on('did-fail-load', (_event, _code, _desc, url, isMainFrame) => {
    if (!isMainFrame || isQuitting || window.isDestroyed()) {
      return;
    }

    if (!url.startsWith('http://127.0.0.1:')) {
      return;
    }

    void window.loadURL(LOADING_PAGE_URL).catch(() => {});
  });

  window.webContents.on('render-process-gone', (_event, details) => {
    if (isQuitting || details.reason === 'clean-exit' || window.isDestroyed()) {
      return;
    }

    // Bound the crash-reload loop so a persistently crashing renderer cannot
    // spin forever.
    if (rendererCrashReloadCount >= RENDERER_CRASH_RELOAD_LIMIT) {
      return;
    }

    rendererCrashReloadCount += 1;

    if (backendPort) {
      void loadDashboard(window, backendPort).catch(() => {});
    }
  });

  window.webContents.on('will-navigate', (event, url) => {
    const allowedOrigin = backendPort
      ? `http://127.0.0.1:${backendPort}`
      : null;
    if (
      !allowedOrigin ||
      !isAllowedAppNavigation(url, allowedOrigin, LOADING_PAGE_URL)
    ) {
      event.preventDefault();
    }
  });

  window.setMenuBarVisibility(false);

  window.once('ready-to-show', () => {
    if (!startHidden && !window.isDestroyed()) {
      window.show();
      if (forceShow) {
        window.focus();
      }
    }
  });

  window.on('close', (event) => {
    if (isQuitting) {
      return;
    }

    event.preventDefault();
    handleMainWindowClose();
  });

  window.on('closed', () => {
    if (mainWindow === window) {
      mainWindow = null;
    }
  });

  mainWindow = window;

  if (isWindows) {
    window.setBackgroundMaterial('mica');
    window.setTitleBarOverlay({
      color: '#00000000',
      height: TITLE_BAR_HEIGHT,
    });
  }

  // Show the themed loading page first, then swap in the real dashboard once
  // the backend child reports its port.
  await window.loadURL(LOADING_PAGE_URL);

  let port = null;
  try {
    port = await backendReadyPromise;
  } catch (error) {
    if (window.isDestroyed()) {
      return window;
    }

    window.destroy();
    throw error;
  }

  if (window.isDestroyed()) {
    return window;
  }

  await loadDashboard(window, port);
  initializeDesktopIntegrations(port);

  if (forceShow && !window.isDestroyed() && !window.isVisible()) {
    focusMainWindow(window);
  }

  return window;
}

function ensureMainWindow(options = {}) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    if (options.forceShow) {
      focusMainWindow(mainWindow);
    }
    return Promise.resolve(mainWindow);
  }

  if (mainWindowCreationPromise) {
    return mainWindowCreationPromise.then((window) => {
      if (options.forceShow) {
        focusMainWindow(window);
      }
      return window;
    });
  }

  mainWindowCreationPromise = createMainWindow(options).finally(() => {
    mainWindowCreationPromise = null;
  });

  return mainWindowCreationPromise;
}

// A teardown race or similar main-process bug must never surface as the
// OS-level "A JavaScript error occurred in the main process" dialog or block
// an in-flight quit; log it and rely on the force-quit timer for shutdown.
process.on('uncaughtException', (error) => {
  console.error('Uncaught exception in Clawalytics main process:', error);
});

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled rejection in Clawalytics main process:', reason);
});

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (!mainWindow || mainWindow.isDestroyed()) {
      void ensureMainWindow({ forceShow: true }).catch(reportMainWindowOpenError);
      return;
    }

    showMainWindow();
  });

  app.whenReady().then(async () => {
    app.setAppUserModelId(APP_ID);
    loadDesktopPreferences();
    Menu.setApplicationMenu(null);
    createTray();
    // Sync entries once on every launch so updates and portable-app moves do
    // not leave Windows pointing at an old executable path.
    await syncLaunchOnStartupSettings();

    ipcMain.handle('get-windows-accent-color', () => {
      return getWindowsAccentColor();
    });

    ipcMain.handle('select-folder', async () => {
      const result = await dialog.showOpenDialog(mainWindow, {
        properties: ['openDirectory'],
        title: 'Select OpenClaw Directory',
      });

      if (result.canceled || result.filePaths.length === 0) {
        return null;
      }

      return result.filePaths[0];
    });

    setupWindowsAccentColorListener();

    if (shouldStartHidden()) {
      const port = await startBackend();
      initializeDesktopIntegrations(port);
    } else {
      await ensureMainWindow();
    }

    app.on('activate', () => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        showMainWindow();
        return;
      }

      if (BrowserWindow.getAllWindows().length === 0) {
        void ensureMainWindow({ forceShow: true }).catch(reportMainWindowOpenError);
      }
    });
  }).catch((error) => {
    dialog.showErrorBox(
      'Clawalytics failed to start',
      error instanceof Error ? error.message : String(error)
    );
    app.quit();
  });

  app.on('window-all-closed', () => {
    if (!isMac) {
      app.quit();
    }
  });

  app.on('before-quit', (event) => {
    if (isQuitting) {
      return;
    }

    event.preventDefault();
    requestAppQuit();
  });
}
