/**
 * Which storage folders Obsidian Sync carries, and moving storage that sits
 * somewhere it cannot into the plugin's synced vault folder.
 */
import { describe, expect, it } from "vitest";
import {
  SYNCED_DATA_FOLDER,
  SYNCED_FEEDS_FOLDER,
  hasUnsyncableStorage,
  isSyncableFolder,
  relocateToSyncableFolders,
} from "../../../src/utils/sync-folders";
import type { PortableDataBundle } from "../../../src/types/types";

const CONFIG_DIR = "config";

function bundle(storageFolder: string, metadataStorageFolder: string) {
  return {
    version: 1,
    exportedAt: 1,
    storageMode: "vault-shards-v2",
    storageFolder,
    metadataStorageMode: "plugin-default",
    metadataStorageFolder,
    metadata: {
      storageFolder,
      metadataStorageFolder,
      feeds: [],
      folders: [],
      availableTags: [],
    },
    shards: [],
    markdownMirrorFallbackPlanned: true,
  } as unknown as PortableDataBundle;
}

describe("isSyncableFolder()", () => {
  it("accepts an ordinary vault folder", () => {
    expect(isSyncableFolder("RSS/feeds", CONFIG_DIR)).toBe(true);
  });

  it("rejects a hidden folder, which Sync skips", () => {
    expect(isSyncableFolder(".rss-dashboard-data/feeds", CONFIG_DIR)).toBe(false);
  });

  it("rejects a folder inside the config folder", () => {
    expect(
      isSyncableFolder(`${CONFIG_DIR}/plugins/rss-dashboard/data`, CONFIG_DIR),
    ).toBe(false);
  });

  it("rejects an empty folder, which falls back to a hidden default", () => {
    expect(isSyncableFolder("", CONFIG_DIR)).toBe(false);
  });
});

describe("hasUnsyncableStorage()", () => {
  const synced = {
    storageMode: "vault-shards-v2" as const,
    storageFolder: SYNCED_FEEDS_FOLDER,
    metadataStorageMode: "plugin-default" as const,
    metadataStorageFolder: SYNCED_DATA_FOLDER,
  };

  it("is false when shards and article state are in synced folders", () => {
    expect(hasUnsyncableStorage(synced, CONFIG_DIR)).toBe(false);
  });

  it("is true when article state is in a hidden folder", () => {
    expect(
      hasUnsyncableStorage(
        { ...synced, metadataStorageFolder: ".rss-dashboard-data" },
        CONFIG_DIR,
      ),
    ).toBe(true);
  });

  it("ignores folders legacy JSON storage does not write to", () => {
    expect(
      hasUnsyncableStorage(
        {
          ...synced,
          storageMode: "legacy-json",
          storageFolder: ".rss-dashboard-data/feeds",
          metadataStorageFolder: ".rss-dashboard-data",
        },
        CONFIG_DIR,
      ),
    ).toBe(false);
  });
});

describe("relocateToSyncableFolders()", () => {
  it("moves storage out of the plugin folder into the synced folder", () => {
    const result = relocateToSyncableFolders(
      bundle(
        `${CONFIG_DIR}/plugins/rss-dashboard/data/feeds`,
        `${CONFIG_DIR}/plugins/rss-dashboard/data`,
      ),
      CONFIG_DIR,
    );

    expect(result.storageFolder).toBe(SYNCED_FEEDS_FOLDER);
    expect(result.metadataStorageFolder).toBe(SYNCED_DATA_FOLDER);
    expect(result.metadata.storageFolder).toBe(SYNCED_FEEDS_FOLDER);
    expect(result.metadata.metadataStorageFolder).toBe(SYNCED_DATA_FOLDER);
  });

  it("keeps folders that already sync", () => {
    const result = relocateToSyncableFolders(
      bundle("RSS/feeds", "RSS"),
      CONFIG_DIR,
    );

    expect(result.storageFolder).toBe("RSS/feeds");
    expect(result.metadataStorageFolder).toBe("RSS");
  });
});
