import type { App } from "obsidian";
import type { Feed, RssDashboardSettings } from "../types/types";
import { loadVaultLocalStorage, saveVaultLocalStorage } from "./vault-local-storage";

/**
 * Settings that belong to one device: how this screen is laid out, and when
 * this device last refreshed. They live in Obsidian's per-device local
 * storage, never in a synced file, so one device's layout or refresh times
 * can never overwrite another's or give Sync something to resolve.
 */
export const DEVICE_SETTING_KEYS = [
  "viewStyle",
  "allArticlesPageSize",
  "unreadArticlesPageSize",
  "readArticlesPageSize",
  "savedArticlesPageSize",
  "starredArticlesPageSize",
  "viewLocation",
  "readerViewLocation",
  "savedArticleOpenLocation",
  "useWebViewer",
  "storageMigrationDismissedUntil",
  "storageMigrationDeferralCount",
  "lastRefreshTimestamp",
  "lastGlobalRefreshCompletedAt",
] as const satisfies readonly (keyof RssDashboardSettings)[];

/** Refresh bookkeeping each feed carries, written by every refresh. */
export const FEED_DEVICE_KEYS = [
  "lastUpdated",
  "lastRefreshAttemptCompletedAt",
  "lastRefreshDiagnostics",
  "lastFetchError",
] as const satisfies readonly (keyof Feed)[];

type DeviceSettingKey = (typeof DEVICE_SETTING_KEYS)[number];
type FeedDeviceKey = (typeof FEED_DEVICE_KEYS)[number];

export interface DeviceState {
  settings: Partial<Pick<RssDashboardSettings, DeviceSettingKey>>;
  feeds: Record<string, Partial<Pick<Feed, FeedDeviceKey>>>;
}

const DEVICE_STATE_KEY = "rss-reader-device-state";
const BACKGROUND_TASKS_KEY = "rss-reader-background-tasks";

function pick<T extends object, K extends keyof T>(
  source: T,
  keys: readonly K[],
): Partial<Pick<T, K>> {
  const picked: Partial<Pick<T, K>> = {};
  for (const key of keys) {
    if (source[key] !== undefined) {
      picked[key] = JSON.parse(JSON.stringify(source[key])) as T[K];
    }
  }
  return picked;
}

/** This device's layout and refresh bookkeeping, taken from the settings. */
export function extractDeviceState(settings: RssDashboardSettings): DeviceState {
  const feeds: DeviceState["feeds"] = {};
  for (const feed of settings.feeds) {
    if (feed.feedId) feeds[feed.feedId] = pick(feed, FEED_DEVICE_KEYS);
  }
  return { settings: pick(settings, DEVICE_SETTING_KEYS), feeds };
}

/** Puts this device's layout and refresh bookkeeping back on loaded settings. */
export function applyDeviceState(
  settings: RssDashboardSettings,
  state: DeviceState | null,
): void {
  if (!state) return;
  Object.assign(settings, state.settings);
  for (const feed of settings.feeds) {
    const saved = feed.feedId ? state.feeds[feed.feedId] : undefined;
    if (saved) Object.assign(feed, saved);
  }
}

/** Removes per-device fields from settings about to be written to a synced file. */
export function stripDeviceState<T extends object>(settings: T): T {
  const stripped = { ...settings } as Record<string, unknown>;
  for (const key of DEVICE_SETTING_KEYS) delete stripped[key];
  if (Array.isArray(stripped.feeds)) {
    stripped.feeds = (stripped.feeds as Record<string, unknown>[]).map((feed) => {
      const copy = { ...feed };
      for (const key of FEED_DEVICE_KEYS) delete copy[key];
      return copy;
    });
  }
  return stripped as T;
}

export function loadDeviceState(app: App): DeviceState | null {
  const stored = loadVaultLocalStorage(app, DEVICE_STATE_KEY);
  if (!stored || typeof stored !== "object") return null;
  const state = stored as Partial<DeviceState>;
  return {
    settings: state.settings && typeof state.settings === "object" ? state.settings : {},
    feeds: state.feeds && typeof state.feeds === "object" ? state.feeds : {},
  };
}

export function saveDeviceState(app: App, settings: RssDashboardSettings): void {
  saveVaultLocalStorage(app, DEVICE_STATE_KEY, extractDeviceState(settings));
}

/**
 * Whether this device runs automatic work: scheduled refreshes, the startup
 * refresh, and automatic fixes. On by default on desktop, which is usually
 * the always-on device; off on phones and tablets, which then do only what
 * the user does by hand.
 */
export function isBackgroundTasksEnabled(app: App, isDesktopApp: boolean): boolean {
  const stored = loadVaultLocalStorage(app, BACKGROUND_TASKS_KEY);
  return typeof stored === "boolean" ? stored : isDesktopApp;
}

export function setBackgroundTasksEnabled(app: App, enabled: boolean): void {
  saveVaultLocalStorage(app, BACKGROUND_TASKS_KEY, enabled);
}
