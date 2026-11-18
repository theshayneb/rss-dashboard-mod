import { normalizePath, type App } from "obsidian";
import {
  SHARED_SETTINGS_SCHEMA_VERSION,
  type SharedEntry,
  type SharedSettingsFile,
  type SharedSettingsSource,
} from "./shared-settings";
import { settingsFingerprint } from "../utils/settings-fingerprint";

/** `settings.<deviceId>.json`, one per device, in the data folder. */
const SETTINGS_FILE_NAME = /^settings\.[A-Za-z0-9_-]+\.json$/;

export type SharedSourcesResult =
  | { status: "ok"; sources: SharedSettingsSource[]; ownFile: SharedSettingsFile | null }
  /** This device's own file exists but cannot be read: never write over it. */
  | { status: "own-unreadable" };

/** Reads and writes the per-device shared settings files. */
export class SharedSettingsStore {
  /** Each file as this device last read or wrote it, to spot real changes. */
  private lastSeenByPath = new Map<string, string>();

  constructor(
    private readonly app: App,
    private readonly deviceId: string,
    private readonly writeWrapper?: <T>(fn: () => Promise<T>) => Promise<T>,
  ) {}

  folder(metadataStorageFolder: string): string {
    const folder = metadataStorageFolder.trim() || ".rss-dashboard-data";
    return normalizePath(folder.replace(/^\/+|\/+$/g, ""));
  }

  ownPath(metadataStorageFolder: string): string {
    return normalizePath(
      `${this.folder(metadataStorageFolder)}/settings.${this.deviceId}.json`,
    );
  }

  isSettingsFilePath(metadataStorageFolder: string, path: string): boolean {
    const folder = this.folder(metadataStorageFolder);
    const normalized = normalizePath(path.replace(/^\/+|\/+$/g, ""));
    return (
      normalized.startsWith(`${folder}/`) &&
      SETTINGS_FILE_NAME.test(normalized.slice(folder.length + 1))
    );
  }

  async readAll(metadataStorageFolder: string): Promise<SharedSourcesResult> {
    const folder = this.folder(metadataStorageFolder);
    const ownPath = this.ownPath(metadataStorageFolder);
    const sources: SharedSettingsSource[] = [];
    let ownFile: SharedSettingsFile | null = null;
    if (!(await this.app.vault.adapter.exists(folder))) {
      return { status: "ok", sources, ownFile };
    }

    const { files } = await this.app.vault.adapter.list(folder);
    for (const path of files.map((file) => normalizePath(file)).sort()) {
      if (!this.isSettingsFilePath(metadataStorageFolder, path)) continue;
      try {
        const parsed = JSON.parse(
          await this.app.vault.adapter.read(path),
        ) as SharedSettingsFile;
        if (!parsed || typeof parsed.entries !== "object") {
          throw new Error("missing entries");
        }
        this.lastSeenByPath.set(path, settingsFingerprint(parsed));
        if (path === ownPath) ownFile = parsed;
        sources.push({ entries: parsed.entries, isOwn: path === ownPath });
      } catch {
        // Another device's file may be half-synced: skip it this time.
        if (path === ownPath) return { status: "own-unreadable" };
      }
    }
    return { status: "ok", sources, ownFile };
  }

  /** Whether another device's settings file holds something not seen yet. */
  async hasChanged(metadataStorageFolder: string, path: string): Promise<boolean> {
    const normalized = normalizePath(path);
    if (normalized === this.ownPath(metadataStorageFolder)) return false;
    try {
      if (!(await this.app.vault.adapter.exists(normalized))) return true;
      const onDisk = settingsFingerprint(
        JSON.parse(await this.app.vault.adapter.read(normalized)),
      );
      return onDisk !== this.lastSeenByPath.get(normalized);
    } catch {
      return true;
    }
  }

  /** Writes this device's file, unless it already holds exactly these entries. */
  async writeOwn(
    metadataStorageFolder: string,
    entries: Record<string, SharedEntry>,
    current: SharedSettingsFile | null,
  ): Promise<boolean> {
    const file: SharedSettingsFile = {
      schemaVersion: SHARED_SETTINGS_SCHEMA_VERSION,
      entries,
    };
    if (current && settingsFingerprint(current) === settingsFingerprint(file)) {
      return false;
    }
    const folder = this.folder(metadataStorageFolder);
    if (!(await this.app.vault.adapter.exists(folder))) {
      try {
        await this.app.vault.createFolder(folder);
      } catch {
        // Another write may have created it first.
      }
    }
    const path = this.ownPath(metadataStorageFolder);
    const write = () =>
      this.app.vault.adapter.write(path, JSON.stringify(file, null, 2));
    if (this.writeWrapper) await this.writeWrapper(write);
    else await write();
    this.lastSeenByPath.set(path, settingsFingerprint(file));
    return true;
  }
}
