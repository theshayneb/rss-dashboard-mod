/**
 * Which storage folders Obsidian Sync carries, and moving storage into the
 * plugin's data folder.
 */
import { describe, expect, it } from "vitest";
import {
  SYNCED_DATA_FOLDER,
  SYNCED_FEEDS_FOLDER,
  hasUnsyncableStorage,
  isInDataFolder,
  isSyncableFolder,
  relocateToDataFolder,
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

describe("isInDataFolder()", () => {
  it("is true only when feeds and article state are both in the data folder", () => {
    expect(
      isInDataFolder({
        storageFolder: SYNCED_FEEDS_FOLDER,
        metadataStorageFolder: SYNCED_DATA_FOLDER,
      }),
    ).toBe(true);
    expect(
      isInDataFolder({
        storageFolder: "RSS/feeds",
        metadataStorageFolder: SYNCED_DATA_FOLDER,
      }),
    ).toBe(false);
  });
});

describe("relocateToDataFolder()", () => {
  it("points feeds and article state at Utilities/RSS Reader", () => {
    const result = relocateToDataFolder(
      bundle(`${CONFIG_DIR}/plugins/rss-dashboard/data/feeds`, "RSS"),
    );

    expect(SYNCED_DATA_FOLDER).toBe("Utilities/RSS Reader");
    expect(result.storageFolder).toBe("Utilities/RSS Reader/feeds");
    expect(result.metadataStorageFolder).toBe("Utilities/RSS Reader");
    expect(result.metadata.storageFolder).toBe("Utilities/RSS Reader/feeds");
    expect(result.metadata.metadataStorageFolder).toBe("Utilities/RSS Reader");
  });
});
