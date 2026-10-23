import { normalizePath } from "obsidian";
import { isHiddenFromSync } from "../services/feed-storage-repository";
import type { PortableDataBundle, RssDashboardSettings } from "../types/types";

/**
 * Vault folder for feed shards and article state that Obsidian Sync can
 * carry: no leading "." and outside the config folder. Distinct from the
 * original plugin's suggested `rss-dashboard-data`, so the two plugins never
 * write the same files while both are enabled.
 */
export const SYNCED_DATA_FOLDER = "rss-dashboard-mod-data";
export const SYNCED_FEEDS_FOLDER = `${SYNCED_DATA_FOLDER}/feeds`;

/**
 * Whether files in a folder reach other devices through Obsidian Sync, and
 * raise vault events here when another device changes them. Sync skips
 * hidden folders, and the config folder syncs only each plugin's own
 * top-level files.
 */
export function isSyncableFolder(folderPath: string, configDir: string): boolean {
  const folder = normalizePath(folderPath.trim());
  if (!folder || folder === "/") return false;
  const config = normalizePath(configDir);
  if (folder === config || folder.startsWith(`${config}/`)) return false;
  return !isHiddenFromSync(folder);
}

/**
 * Whether any file this storage setup writes outside data.json sits in a
 * folder Sync skips: feed shards, v2's user-state.json (read, starred, and
 * tag state), or a data.json moved into a vault folder.
 */
export function hasUnsyncableStorage(
  settings: Pick<
    RssDashboardSettings,
    | "storageMode"
    | "storageFolder"
    | "metadataStorageMode"
    | "metadataStorageFolder"
  >,
  configDir: string,
): boolean {
  const usesShards = settings.storageMode !== "legacy-json";
  const usesMetadataFolder =
    settings.storageMode === "vault-shards-v2" ||
    settings.metadataStorageMode === "vault-location";
  return (
    (usesShards && !isSyncableFolder(settings.storageFolder, configDir)) ||
    (usesMetadataFolder &&
      !isSyncableFolder(settings.metadataStorageFolder, configDir))
  );
}

/**
 * Points a bundle's feed and metadata storage at {@link SYNCED_DATA_FOLDER}
 * when they sit somewhere Sync cannot carry. Folders that already sync are
 * kept.
 */
export function relocateToSyncableFolders(
  bundle: PortableDataBundle,
  configDir: string,
): PortableDataBundle {
  const storageFolder =
    bundle.metadata.storageFolder ?? bundle.storageFolder ?? "";
  const metadataStorageFolder =
    bundle.metadataStorageFolder ?? bundle.metadata.metadataStorageFolder ?? "";

  const nextStorageFolder = isSyncableFolder(storageFolder, configDir)
    ? storageFolder
    : SYNCED_FEEDS_FOLDER;
  const nextMetadataFolder = isSyncableFolder(metadataStorageFolder, configDir)
    ? metadataStorageFolder
    : SYNCED_DATA_FOLDER;

  return {
    ...bundle,
    storageFolder: nextStorageFolder,
    metadataStorageFolder: nextMetadataFolder,
    metadata: {
      ...bundle.metadata,
      storageFolder: nextStorageFolder,
      metadataStorageFolder: nextMetadataFolder,
    },
  };
}
