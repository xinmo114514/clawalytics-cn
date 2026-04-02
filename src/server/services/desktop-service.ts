import fs from 'fs';
import path from 'path';
import { ensureConfigDir, getConfigDir } from '../config/loader.js';

export type DesktopLocale = 'zh' | 'en';
export type DesktopCloseAction = 'ask' | 'tray' | 'quit';
export type DesktopCloseChoiceAction = DesktopCloseAction | 'cancel';
export type DesktopStartupMode = 'window' | 'tray';
export type DesktopNotificationTrigger = 'activity' | 'cost' | 'tokens' | 'both';

export interface DesktopPreferences {
  locale: DesktopLocale;
  closeAction: DesktopCloseAction;
  launchOnStartup: boolean;
  startupMode: DesktopStartupMode;
  notificationsEnabled: boolean;
  notificationTrigger: DesktopNotificationTrigger;
  notificationDelaySeconds: number;
}

interface DesktopBridge {
  handleCloseChoice?: (action: DesktopCloseChoiceAction) => Promise<void> | void;
  syncPreferences?: (preferences: DesktopPreferences) => Promise<void> | void;
}

const DESKTOP_PREFERENCES_PATH = path.join(getConfigDir(), 'desktop-preferences.json');
const DEFAULT_DESKTOP_PREFERENCES: DesktopPreferences = {
  locale: 'en',
  closeAction: 'ask',
  launchOnStartup: false,
  startupMode: 'window',
  notificationsEnabled: true,
  notificationTrigger: 'activity',
  notificationDelaySeconds: 30,
};

let desktopBridge: DesktopBridge = {};

function normalizeLocale(value: unknown): DesktopLocale {
  return value === 'zh' ? 'zh' : 'en';
}

function normalizeCloseAction(value: unknown): DesktopCloseAction {
  return value === 'tray' || value === 'quit' ? value : 'ask';
}

function normalizeLaunchOnStartup(value: unknown): boolean {
  return value === true;
}

function normalizeStartupMode(value: unknown): DesktopStartupMode {
  return value === 'tray' ? 'tray' : 'window';
}

function normalizeNotificationsEnabled(value: unknown): boolean {
  return value === false ? false : true;
}

function normalizeNotificationTrigger(value: unknown): DesktopNotificationTrigger {
  return value === 'cost' || value === 'tokens' || value === 'both'
    ? value
    : 'activity';
}

function normalizeNotificationDelaySeconds(value: unknown): number {
  const parsed = typeof value === 'number'
    ? value
    : Number.parseInt(String(value ?? ''), 10);

  if (!Number.isFinite(parsed)) {
    return DEFAULT_DESKTOP_PREFERENCES.notificationDelaySeconds;
  }

  return Math.min(3600, Math.max(5, Math.round(parsed)));
}

export function loadDesktopPreferences(): DesktopPreferences {
  ensureConfigDir();

  if (!fs.existsSync(DESKTOP_PREFERENCES_PATH)) {
    return { ...DEFAULT_DESKTOP_PREFERENCES };
  }

  try {
    const parsed = JSON.parse(fs.readFileSync(DESKTOP_PREFERENCES_PATH, 'utf-8')) as Partial<DesktopPreferences>;
    return {
      locale: normalizeLocale(parsed.locale),
      closeAction: normalizeCloseAction(parsed.closeAction),
      launchOnStartup: normalizeLaunchOnStartup(parsed.launchOnStartup),
      startupMode: normalizeStartupMode(parsed.startupMode),
      notificationsEnabled: normalizeNotificationsEnabled(parsed.notificationsEnabled),
      notificationTrigger: normalizeNotificationTrigger(parsed.notificationTrigger),
      notificationDelaySeconds: normalizeNotificationDelaySeconds(
        parsed.notificationDelaySeconds
      ),
    };
  } catch (error) {
    console.error('Failed to load desktop preferences:', error);
    return { ...DEFAULT_DESKTOP_PREFERENCES };
  }
}

export function saveDesktopPreferences(
  updates: Partial<DesktopPreferences>
): DesktopPreferences {
  ensureConfigDir();

  const current = loadDesktopPreferences();
  const next: DesktopPreferences = {
    locale: normalizeLocale(updates.locale ?? current.locale),
    closeAction: normalizeCloseAction(updates.closeAction ?? current.closeAction),
    launchOnStartup: normalizeLaunchOnStartup(
      updates.launchOnStartup ?? current.launchOnStartup
    ),
    startupMode: normalizeStartupMode(updates.startupMode ?? current.startupMode),
    notificationsEnabled: normalizeNotificationsEnabled(
      updates.notificationsEnabled ?? current.notificationsEnabled
    ),
    notificationTrigger: normalizeNotificationTrigger(
      updates.notificationTrigger ?? current.notificationTrigger
    ),
    notificationDelaySeconds: normalizeNotificationDelaySeconds(
      updates.notificationDelaySeconds ?? current.notificationDelaySeconds
    ),
  };

  fs.writeFileSync(
    DESKTOP_PREFERENCES_PATH,
    JSON.stringify(next, null, 2),
    'utf-8'
  );

  return next;
}

export function setDesktopBridge(bridge: DesktopBridge): void {
  desktopBridge = bridge;
}

export function clearDesktopBridge(): void {
  desktopBridge = {};
}

export async function notifyDesktopPreferencesChanged(
  preferences: DesktopPreferences
): Promise<void> {
  await desktopBridge.syncPreferences?.(preferences);
}

export async function handleDesktopCloseChoice(
  action: DesktopCloseChoiceAction
): Promise<void> {
  await desktopBridge.handleCloseChoice?.(action);
}
