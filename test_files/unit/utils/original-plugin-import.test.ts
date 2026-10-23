/**
 * Importing from the upstream RSS Dashboard plugin into this fork: reading
 * its portable bundle while it is loaded, and moving storage paths out of
 * its plugin folder so the fork does not depend on it staying installed.
 */
import { describe, expect, it, vi } from "vitest";
import type { App } from "obsidian";
import {
  ORIGINAL_PLUGIN_ID,
  readOriginalPluginSnapshot,
  relocatePluginFolderPaths,
} from "../../../src/utils/original-plugin-import";
import type { PortableDataBundle } from "../../../src/types/types";

function appWith(plugin: unknown): App {
  return {
    vault: { configDir: "config" },
    plugins: {
      getPlugin: (id: string) => (id === ORIGINAL_PLUGIN_ID ? plugin : null),
    },
  } as unknown as App;
}

function bundle(paths: {
  storageFolder?: string;
  metadataStorageFolder?: string;
}): PortableDataBundle {
  return {
    version: 1,
    exportedAt: 1,
    storageMode: "vault-shards-v2",
    storageFolder: paths.storageFolder,
    metadataStorageMode: "plugin-default",
    metadataStorageFolder: paths.metadataStorageFolder,
    metadata: {
      storageFolder: paths.storageFolder,
      metadataStorageFolder: paths.metadataStorageFolder,
      feeds: [],
      folders: [],
      availableTags: [],
    },
    shards: [],
    markdownMirrorFallbackPlanned: true,
  } as unknown as PortableDataBundle;
}

describe("readOriginalPluginSnapshot()", () => {
  it("returns the original plugin's bundle and folder when it is enabled", () => {
    const portable = { version: 1 };
    const snapshot = readOriginalPluginSnapshot(
      appWith({
        manifest: { dir: "config/plugins/rss-dashboard" },
        getPortableDataBundle: vi.fn(() => portable),
      }),
    );

    expect(snapshot).toEqual({
      bundle: portable,
      pluginDir: "config/plugins/rss-dashboard",
    });
  });

  it("returns null when the original plugin is not enabled", () => {
    expect(readOriginalPluginSnapshot(appWith(null))).toBeNull();
  });

  it("returns null when the original plugin cannot export a bundle", () => {
    expect(readOriginalPluginSnapshot(appWith({ manifest: {} }))).toBeNull();
  });
});

describe("relocatePluginFolderPaths()", () => {
  const from = "config/plugins/rss-dashboard";
  const to = "config/plugins/rss-dashboard-mod";

  it("moves storage inside the original plugin folder into this plugin's folder", () => {
    const result = relocatePluginFolderPaths(
      bundle({
        storageFolder: `${from}/data/feeds`,
        metadataStorageFolder: `${from}/data`,
      }),
      from,
      to,
    );

    expect(result.storageFolder).toBe(`${to}/data/feeds`);
    expect(result.metadataStorageFolder).toBe(`${to}/data`);
    expect(result.metadata.storageFolder).toBe(`${to}/data/feeds`);
    expect(result.metadata.metadataStorageFolder).toBe(`${to}/data`);
  });

  it("keeps vault folders outside the original plugin folder", () => {
    const result = relocatePluginFolderPaths(
      bundle({
        storageFolder: ".rss-dashboard-data/feeds",
        metadataStorageFolder: "RSS",
      }),
      from,
      to,
    );

    expect(result.storageFolder).toBe(".rss-dashboard-data/feeds");
    expect(result.metadata.metadataStorageFolder).toBe("RSS");
  });

  it("does not treat a sibling folder sharing the name prefix as inside it", () => {
    const result = relocatePluginFolderPaths(
      bundle({ storageFolder: `${from}-other/feeds` }),
      from,
      to,
    );

    expect(result.storageFolder).toBe(`${from}-other/feeds`);
  });
});
