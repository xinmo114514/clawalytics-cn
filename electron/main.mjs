import {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  Menu,
  nativeImage,
  Notification,
  shell,
  systemPreferences,
  Tray,
} from 'electron';
import { execFile } from 'node:child_process';
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import WebSocket from 'ws';

const isMac = process.platform === 'darwin';
const isWindows = process.platform === 'win32';
const APP_ID = 'com.clawalytics.desktop';
const COSTS_WS_RECONNECT_MS = 5000;
const FORCE_QUIT_TIMEOUT_MS = 5000;
const STARTUP_SYNC_REPAIR_DELAY_MS = 2000;
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
const CURRENCY_CNY = 'CNY';
const CURRENCY_USD = 'USD';
const USD_TO_CNY_RATE = 7;

let backendModule = null;
let backendPort = null;
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

function hexToOklch(hex) {
  if (!hex || typeof hex !== 'string') {
    return null;
  }

  const cleanHex = hex.replace('#', '');
  if (!/^[0-9A-Fa-f]{6}$/.test(cleanHex)) {
    return null;
  }

  const r = parseInt(cleanHex.substr(0, 2), 16) / 255;
  const g = parseInt(cleanHex.substr(2, 2), 16) / 255;
  const b = parseInt(cleanHex.substr(4, 2), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;

  let h = 0;
  let s = 0;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
        break;
      case g:
        h = ((b - r) / d + 2) / 6;
        break;
      case b:
        h = ((r - g) / d + 4) / 6;
        break;
    }
  }

  const hDeg = h * 360;

  return `oklch(0.55 0.2 ${hDeg.toFixed(0)})`;
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

    return hexToOklch(accentColorHex);
  } catch (error) {
    console.error('Failed to get Windows accent color:', error);
    return null;
  }
}

function setupWindowsAccentColorListener() {
  if (!isWindows) {
    return;
  }

  let lastAccentColor = getWindowsAccentColor();

  setInterval(() => {
    const currentAccentColor = getWindowsAccentColor();

    if (currentAccentColor && currentAccentColor !== lastAccentColor) {
      lastAccentColor = currentAccentColor;

      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('windows-accent-color-changed', currentAccentColor);
      }
    }
  }, 1000);
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

function normalizeStats(stats) {
  const totalTokens = stats?.totalTokens ?? {};

  return {
    totalCost: Number(stats?.totalCost ?? 0),
    monthCost: Number(stats?.monthCost ?? 0),
    totalTokens: {
      input: Number(totalTokens.input ?? 0),
      output: Number(totalTokens.output ?? 0),
      cacheRead: Number(totalTokens.cacheRead ?? 0),
      cacheCreation: Number(totalTokens.cacheCreation ?? 0),
    },
    cacheSavings: Number(stats?.cacheSavings ?? 0),
    activeSessionsThisMonth: Number(stats?.activeSessionsThisMonth ?? 0),
  };
}

function getTotalTokens(stats) {
  return (
    stats.totalTokens.input
    + stats.totalTokens.output
    + stats.totalTokens.cacheRead
    + stats.totalTokens.cacheCreation
  );
}

function diffStats(previous, current) {
  return {
    totalCost: Math.max(0, current.totalCost - previous.totalCost),
    totalTokens: {
      input: Math.max(0, current.totalTokens.input - previous.totalTokens.input),
      output: Math.max(0, current.totalTokens.output - previous.totalTokens.output),
      cacheRead: Math.max(0, current.totalTokens.cacheRead - previous.totalTokens.cacheRead),
      cacheCreation: Math.max(0, current.totalTokens.cacheCreation - previous.totalTokens.cacheCreation),
    },
  };
}

function hasMeaningfulCostDelta(delta) {
  return delta.totalCost > 0.000001 || getTotalTokens(delta) > 0;
}

function hasCostDelta(delta) {
  return delta.totalCost > 0.000001;
}

function hasTokenDelta(delta) {
  return getTotalTokens(delta) > 0;
}

function shouldShowCostsNotification(delta) {
  if (!getSavedNotificationsEnabled()) {
    return false;
  }

  const notificationTrigger = getSavedNotificationTrigger();
  const costChanged = hasCostDelta(delta);
  const tokensChanged = hasTokenDelta(delta);

  switch (notificationTrigger) {
    case NOTIFICATION_TRIGGER_COST:
      return costChanged;
    case NOTIFICATION_TRIGGER_TOKENS:
      return tokensChanged;
    case NOTIFICATION_TRIGGER_BOTH:
      return costChanged && tokensChanged;
    case NOTIFICATION_TRIGGER_ACTIVITY:
    default:
      return costChanged || tokensChanged;
  }
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

function loadDesktopPreferences() {
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

function quoteWindowsCommandArgument(value) {
  return `"${String(value).replace(/"/g, '\\"')}"`;
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
  const normalizedExecPath = process.execPath.toLowerCase();
  const normalizedHiddenArg = STARTUP_HIDDEN_ARG.toLowerCase();

  return (
    normalizedStdout.includes(normalizedExecPath)
    && (args.length > 0 || !normalizedStdout.includes(normalizedHiddenArg))
    && args.every((arg) => normalizedStdout.includes(String(arg).toLowerCase()))
  );
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
    await setWindowsStartupApproved(false, registryNames);
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
    quoteWindowsCommandArgument(process.execPath),
    ...args,
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
  await setWindowsStartupApproved(true, registryNames);
}

async function syncLaunchOnStartupSettings(strict = false) {
  if (!app.isPackaged) {
    return false;
  }

  try {
    const openAtLogin = getSavedLaunchOnStartup();
    const args = getStartupLaunchArgs();

    app.setLoginItemSettings({
      name: STARTUP_REGISTRY_VALUE_NAME,
      openAtLogin,
      path: process.execPath,
      args,
    });

    await writeWindowsStartupRegistry(openAtLogin, args);

    const loginItemSettings = app.getLoginItemSettings({
      name: STARTUP_REGISTRY_VALUE_NAME,
      path: process.execPath,
      args,
    });
    const hasStartupRegistryValue = await hasExpectedWindowsStartupRegistryValue(args);

    if (!openAtLogin) {
      if (hasStartupRegistryValue) {
        throw new Error('Windows startup registry entry is still present after disabling launch at startup.');
      }

      return false;
    }

    if (openAtLogin && !loginItemSettings.openAtLogin && !hasStartupRegistryValue) {
      throw new Error('Windows did not report the login item as enabled, and the registry entry was not found after saving it.');
    }

    return loginItemSettings.openAtLogin || hasStartupRegistryValue;
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

  loadDesktopPreferences();
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
    loadDesktopPreferences();
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

async function fetchEnhancedStats(port) {
  const response = await fetch(`http://127.0.0.1:${port}/api/stats/enhanced`);

  if (!response.ok) {
    throw new Error(`Failed to fetch enhanced stats: ${response.status}`);
  }

  return normalizeStats(await response.json());
}

function showCostsNotification(currentStats) {
  if (!lastNotifiedStatsSnapshot) {
    lastNotifiedStatsSnapshot = currentStats;
    return false;
  }

  const delta = diffStats(lastNotifiedStatsSnapshot, currentStats);

  if (!hasMeaningfulCostDelta(delta) || !shouldShowCostsNotification(delta)) {
    return false;
  }

  const messageParts = [];
  const totalDeltaTokens = getTotalTokens(delta);

  if (totalDeltaTokens > 0) {
    messageParts.push(
      translateDesktop(
        `新增 ${formatInteger(totalDeltaTokens)} 词元`,
        `Added ${formatInteger(totalDeltaTokens)} tokens`
      )
    );
  }

  if (delta.totalCost > 0) {
    messageParts.push(
      translateDesktop(
        `成本 +${formatCurrency(delta.totalCost)}`,
        `Cost +${formatCurrency(delta.totalCost)}`
      )
    );
  }

  showNativeNotification({
    title: translateDesktop('OpenClaw 用量已更新', 'OpenClaw usage updated'),
    body: `${messageParts.join(
      translateDesktop('，', ', ')
    )}\n${translateDesktop('累计成本', 'Total cost')} ${formatCurrency(currentStats.totalCost)}`,
  });

  lastNotifiedStatsSnapshot = currentStats;
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

  const delta = diffStats(lastNotifiedStatsSnapshot, latestStatsSnapshot);

  if (!hasMeaningfulCostDelta(delta)) {
    lastNotifiedStatsSnapshot = latestStatsSnapshot;
    return;
  }

  if (!shouldShowCostsNotification(delta)) {
    lastNotifiedStatsSnapshot = latestStatsSnapshot;
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
      const stats = await fetchEnhancedStats(backendPort);

      latestStatsSnapshot = stats;

      if (!lastNotifiedStatsSnapshot) {
        lastNotifiedStatsSnapshot = stats;
        continue;
      }

      const delta = diffStats(lastNotifiedStatsSnapshot, stats);

      if (!hasMeaningfulCostDelta(delta)) {
        continue;
      }

      if (!getSavedNotificationsEnabled()) {
        clearPendingCostsNotification();
        lastNotifiedStatsSnapshot = stats;
        continue;
      }

      if (!shouldShowCostsNotification(delta)) {
        clearPendingCostsNotification();
        lastNotifiedStatsSnapshot = stats;
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
    costsSocket.removeAllListeners();
    costsSocket.close();
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

  if (costsSocket) {
    costsSocket.removeAllListeners();
    costsSocket.close();
    costsSocket = null;
  }

  const socket = new WebSocket(`ws://127.0.0.1:${port}/ws`);
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

async function startBackend() {
  if (backendModule && backendPort) {
    return backendPort;
  }

  const port = await findFreePort();
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

  await backendModule.start({ port });
  if (typeof backendModule.setDesktopBridge === 'function') {
    backendModule.setDesktopBridge({
      handleCloseChoice: (action) => handleDesktopCloseChoice(action),
      syncPreferences: (preferences) => syncDesktopPreferences(preferences),
    });
  }

  backendPort = port;
  return port;
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

  if (backendModule && typeof backendModule.clearDesktopBridge === 'function') {
    backendModule.clearDesktopBridge();
  }

  if (!backendModule || typeof backendModule.stop !== 'function') {
    backendModule = null;
    backendPort = null;
    desktopIntegrationsPort = null;
    return;
  }

  try {
    await backendModule.stop();
  } finally {
    backendModule = null;
    backendPort = null;
    desktopIntegrationsPort = null;
  }
}

async function createMainWindow(options = {}) {
  const { forceShow = false } = options;
  const port = await startBackend();
  const startHidden = !forceShow && shouldStartHidden();

  const preloadPath = getAppAssetPath('electron', 'preload.mjs');

  const window = new BrowserWindow({
    width: 1440,
    height: 920,
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
      sandbox: false,
      spellcheck: false,
      preload: preloadPath,
    },
  });

  window.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url);
    return { action: 'deny' };
  });

  window.setMenuBarVisibility(false);

  window.once('ready-to-show', () => {
    if (!startHidden) {
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

  await window.loadURL(`http://127.0.0.1:${port}`);
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

function scheduleLaunchOnStartupRepair() {
  if (!app.isPackaged) {
    return;
  }

  const timer = setTimeout(() => {
    void syncLaunchOnStartupSettings().catch((error) => {
      console.error('Failed to repair launch on startup settings:', error);
    });
  }, STARTUP_SYNC_REPAIR_DELAY_MS);

  if (typeof timer.unref === 'function') {
    timer.unref();
  }
}

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
    scheduleLaunchOnStartupRepair();

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
