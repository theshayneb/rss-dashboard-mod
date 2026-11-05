import type { App } from "obsidian";
import { loadVaultLocalStorage, saveVaultLocalStorage } from "./vault-local-storage";

const DEVICE_ID_KEY = "rss-reader-device-id";
const DEVICE_ID_PATTERN = /^[A-Za-z0-9_-]{4,40}$/;

/**
 * A stable id for this device in this vault, kept in Obsidian's per-device
 * local storage so it never syncs. It names this device's article state
 * file, such as `user-state.desktop-k3x9q2m1.json`.
 */
export function getOrCreateDeviceId(app: App, isMobile: boolean): string {
  const stored = loadVaultLocalStorage(app, DEVICE_ID_KEY);
  if (typeof stored === "string" && DEVICE_ID_PATTERN.test(stored)) {
    return stored;
  }

  const suffix = Math.random().toString(36).slice(2, 10).padEnd(8, "0");
  const deviceId = `${isMobile ? "mobile" : "desktop"}-${suffix}`;
  saveVaultLocalStorage(app, DEVICE_ID_KEY, deviceId);
  return deviceId;
}
