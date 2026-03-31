import {
  app,
  BrowserWindow,
  dialog,
  Menu,
  Notification,
  Tray,
  nativeImage,
  shell,
} from 'electron';
import fs from 'node:fs';
import http from 'node:http';
import net from 'node:net';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import WebSocket from 'ws';

const isMac = process.platform === 'darwin';
const isWindows = process.platform === 'win32';
const APP_ID = 'com.clawalytics.desktop';
const STARTUP_TIMEOUT_MS = 30000;
const COSTS_NOTIFICATION_COOLDOWN_MS = 30000;
const COSTS_WS_RECONNECT_MS = 5000;
const FORCE_QUIT_TIMEOUT_MS = 5000;
const TITLE_BAR_HEIGHT = 48;
const DESKTOP_PREFERENCES_FILE = 'desktop-preferences.json';
const CLOSE_ACTION_ASK = 'ask';
const CLOSE_ACTION_TRAY = 'tray';
const CLOSE_ACTION_QUIT = 'quit';

let backendModule = null;
let backendPort = null;
let isQuitting = false;
let mainWindow = null;
let tray = null;
let trayHintShown = false;
let costsSocket = null;
let costsReconnectTimer = null;
let pendingCostsNotificationTimer = null;
let latestStatsSnapshot = null;
let lastNotifiedStatsSnapshot = null;
let lastCostsNotificationAt = 0;
let isRefreshingCostStats = false;
let hasQueuedCostRefresh = false;
let isHandlingCloseChoice = false;
let forceQuitTimer = null;
let desktopPreferences = {
  closeAction: CLOSE_ACTION_ASK,
};

const integerFormatter = new Intl.NumberFormat('en-US');
const usdFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 4,
});

function getAppAssetPath(...segments) {
  return path.join(app.getAppPath(), ...segments);
}

function getDesktopPreferencesPath() {
  return path.join(app.getPath('userData'), DESKTOP_PREFERENCES_FILE);
}

function getIcon() {
  const iconPath = getAppAssetPath('public', 'images', 'app-icon.ico');
  const icon = nativeImage.createFromPath(iconPath);
  return icon.isEmpty() ? undefined : icon;
}

function formatInteger(value) {
  return integerFormatter.format(Math.round(value));
}

function formatUsd(value) {
  return usdFormatter.format(value);
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

function normalizeCloseAction(value) {
  if (value === CLOSE_ACTION_TRAY || value === CLOSE_ACTION_QUIT) {
    return value;
  }

  return CLOSE_ACTION_ASK;
}

function getSavedCloseAction() {
  return normalizeCloseAction(desktopPreferences?.closeAction);
}

function getCloseActionLabel(action) {
  switch (action) {
    case CLOSE_ACTION_TRAY:
      return 'Minimize to tray';
    case CLOSE_ACTION_QUIT:
      return 'Quit app';
    default:
      return 'Ask every time';
  }
}

function loadDesktopPreferences() {
  try {
    const filePath = getDesktopPreferencesPath();

    if (!fs.existsSync(filePath)) {
      desktopPreferences = { closeAction: CLOSE_ACTION_ASK };
      return;
    }

    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    desktopPreferences = {
      closeAction: normalizeCloseAction(parsed?.closeAction),
    };
  } catch (error) {
    console.error('Failed to load desktop preferences:', error);
    desktopPreferences = { closeAction: CLOSE_ACTION_ASK };
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

function showMainWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return;
  }

  if (mainWindow.isMinimized()) {
    mainWindow.restore();
  }

  mainWindow.show();
  mainWindow.focus();
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
    title: 'Clawalytics is still running',
    body: 'Open it from the system tray or right-click the tray icon to quit.',
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
      label: 'Open Clawalytics',
      click: () => {
        showMainWindow();
      },
    },
    {
      label: `Close button: ${getCloseActionLabel(savedCloseAction)}`,
      enabled: false,
    },
    {
      label: 'Ask on close again',
      enabled: savedCloseAction !== CLOSE_ACTION_ASK,
      click: () => {
        setCloseActionPreference(CLOSE_ACTION_ASK);
      },
    },
    { type: 'separator' },
    {
      label: 'Quit',
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

async function promptForCloseAction(window) {
  const result = await dialog.showMessageBox(window, {
    type: 'question',
    buttons: ['Minimize to tray', 'Quit', 'Cancel'],
    defaultId: 0,
    cancelId: 2,
    noLink: true,
    title: 'Close Clawalytics',
    message: 'What should happen when you close Clawalytics?',
    detail: 'You can keep it running in the background or fully exit the app.',
    checkboxLabel: 'Remember my choice for next time',
  });

  if (result.response === 0) {
    if (result.checkboxChecked) {
      setCloseActionPreference(CLOSE_ACTION_TRAY);
    }

    hideWindowToTray();
    return;
  }

  if (result.response === 1) {
    if (result.checkboxChecked) {
      setCloseActionPreference(CLOSE_ACTION_QUIT);
    }

    requestAppQuit();
  }
}

async function handleMainWindowClose(window) {
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

  try {
    await promptForCloseAction(window);
  } finally {
    isHandlingCloseChoice = false;
  }
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

  if (!hasMeaningfulCostDelta(delta)) {
    return false;
  }

  const messageParts = [];
  const totalDeltaTokens = getTotalTokens(delta);

  if (totalDeltaTokens > 0) {
    messageParts.push(`Added ${formatInteger(totalDeltaTokens)} tokens`);
  }

  if (delta.totalCost > 0) {
    messageParts.push(`Cost +${formatUsd(delta.totalCost)}`);
  }

  showNativeNotification({
    title: 'OpenClaw usage updated',
    body: `${messageParts.join(', ')}\nTotal cost ${formatUsd(currentStats.totalCost)}`,
  });

  lastNotifiedStatsSnapshot = currentStats;
  lastCostsNotificationAt = Date.now();
  return true;
}

function schedulePendingCostsNotification() {
  if (pendingCostsNotificationTimer || !lastNotifiedStatsSnapshot) {
    return;
  }

  const delay = Math.max(
    0,
    lastCostsNotificationAt + COSTS_NOTIFICATION_COOLDOWN_MS - Date.now()
  );

  pendingCostsNotificationTimer = setTimeout(() => {
    pendingCostsNotificationTimer = null;

    if (!latestStatsSnapshot || !lastNotifiedStatsSnapshot) {
      return;
    }

    showCostsNotification(latestStatsSnapshot);
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

      if (Date.now() - lastCostsNotificationAt >= COSTS_NOTIFICATION_COOLDOWN_MS) {
        showCostsNotification(stats);
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
  if (pendingCostsNotificationTimer) {
    clearTimeout(pendingCostsNotificationTimer);
    pendingCostsNotificationTimer = null;
  }

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

async function initializeDesktopIntegrations(port) {
  createTray();

  if (!lastNotifiedStatsSnapshot) {
    const stats = await fetchEnhancedStats(port);
    latestStatsSnapshot = stats;
    lastNotifiedStatsSnapshot = stats;
  }

  connectCostsSocket(port);
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

function checkHealth(port) {
  return new Promise((resolve) => {
    const request = http.get(`http://127.0.0.1:${port}/api/health`, (response) => {
      response.resume();
      resolve(response.statusCode === 200);
    });

    request.on('error', () => resolve(false));
    request.setTimeout(2000, () => {
      request.destroy();
      resolve(false);
    });
  });
}

async function waitForHealth(port, timeoutMs = STARTUP_TIMEOUT_MS) {
  const startTime = Date.now();

  while (Date.now() - startTime < timeoutMs) {
    if (await checkHealth(port)) {
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  throw new Error(`Clawalytics backend did not become healthy within ${timeoutMs}ms.`);
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
  process.env.PORT = String(port);

  backendModule = await import(serverEntry);

  if (typeof backendModule.start !== 'function') {
    throw new Error('Desktop backend entry does not export a start() function.');
  }

  await backendModule.start({ port });
  await waitForHealth(port);

  backendPort = port;
  return port;
}

async function stopBackend() {
  closeCostsSocket();
  latestStatsSnapshot = null;
  lastNotifiedStatsSnapshot = null;
  lastCostsNotificationAt = 0;
  trayHintShown = false;

  if (tray) {
    tray.destroy();
    tray = null;
  }

  if (!backendModule || typeof backendModule.stop !== 'function') {
    backendModule = null;
    backendPort = null;
    return;
  }

  try {
    await backendModule.stop();
  } finally {
    backendModule = null;
    backendPort = null;
  }
}

async function createMainWindow() {
  const port = await startBackend();

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
      sandbox: true,
      spellcheck: false,
    },
  });

  window.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url);
    return { action: 'deny' };
  });

  window.setMenuBarVisibility(false);

  window.once('ready-to-show', () => {
    window.show();
  });

  window.on('close', (event) => {
    if (isQuitting) {
      return;
    }

    event.preventDefault();
    void handleMainWindowClose(window);
  });

  window.on('closed', () => {
    if (mainWindow === window) {
      mainWindow = null;
    }
  });

  if (isWindows) {
    window.setBackgroundMaterial('mica');
    window.setTitleBarOverlay({
      color: '#00000000',
      height: TITLE_BAR_HEIGHT,
    });
  }

  await window.loadURL(`http://127.0.0.1:${port}`);
  mainWindow = window;
  await initializeDesktopIntegrations(port);
  return window;
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (!mainWindow || mainWindow.isDestroyed()) {
      return;
    }

    showMainWindow();
  });

  app.whenReady().then(async () => {
    app.setAppUserModelId(APP_ID);
    loadDesktopPreferences();
    Menu.setApplicationMenu(null);
    createTray();
    await createMainWindow();

    app.on('activate', () => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        showMainWindow();
        return;
      }

      if (BrowserWindow.getAllWindows().length === 0) {
        void createMainWindow();
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
