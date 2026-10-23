/**
 * Obsidian Sync support: settings that another device changes are picked up
 * without a restart, and storage Sync cannot carry can be moved to a vault
 * folder it does.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App, type PluginManifest } from "obsidian";

import RssDashboardPlugin from "../../../main";
import { DEFAULT_SETTINGS, type Feed } from "../../../src/types/types";

const PLUGIN_DIR = "config/plugins/rss-dashboard-mod";

function manifest(): PluginManifest {
  return {
    id: "rss-dashboard-mod",
    name: "RSS Reader",
    version: "2.7.4",
    minAppVersion: "1.8.7",
    author: "test",
    description: "test",
    dir: PLUGIN_DIR,
  };
}

function sampleFeed(): Feed {
  return {
    title: "Test Feed",
    url: "https://example.com/feed.xml",
    folder: "Uncategorized",
    feedId: "feed-1",
    items: [
      {
        title: "Test Article",
        link: "https://example.com/1",
        description: "Test description",
        pubDate: "2024-01-01T00:00:00Z",
        guid: "https://example.com/1",
        read: true,
        starred: true,
        tags: [],
        feedTitle: "Test Feed",
        feedUrl: "https://example.com/feed.xml",
        coverImage: "",
      },
    ],
    lastUpdated: Date.now(),
    mediaType: "article",
  };
}

async function launch(app: App, data: unknown): Promise<RssDashboardPlugin> {
  const plugin = new RssDashboardPlugin(app, manifest());
  plugin.loadData = vi.fn().mockResolvedValue(data);
  plugin.saveData = vi.fn().mockResolvedValue(undefined);
  await plugin.loadSettings();
  return plugin;
}

beforeEach(() => {
  vi.restoreAllMocks();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("settings changed by another device", () => {
  it("reloads settings when Obsidian reports an external data.json change", async () => {
    vi.useFakeTimers();
    const plugin = await launch(App.createMock(), null);
    const reload = vi.spyOn(plugin, "loadSettings").mockResolvedValue();

    await plugin.onExternalSettingsChange();
    await vi.advanceTimersByTimeAsync(2000);

    expect(reload).toHaveBeenCalledTimes(1);
  });

  it("ignores the change its own save just wrote", async () => {
    vi.useFakeTimers();
    const plugin = await launch(App.createMock(), null);
    const reload = vi.spyOn(plugin, "loadSettings").mockResolvedValue();

    await plugin.writeWithWatcherSuppressed(async () => {});
    await plugin.onExternalSettingsChange();
    await vi.advanceTimersByTimeAsync(2000);

    expect(reload).not.toHaveBeenCalled();
  });
});

describe("moving storage to a folder Obsidian Sync carries", () => {
  it("rewrites shards and article state into the synced folder", async () => {
    const app = App.createMock();
    const pluginDir = `${app.vault.configDir}/plugins/rss-dashboard-mod`;
    const plugin = await launch(app, {
      ...JSON.parse(JSON.stringify(DEFAULT_SETTINGS)),
      storageMode: "vault-shards-v2",
      storageFolder: `${pluginDir}/data/feeds`,
      metadataStorageFolder: `${pluginDir}/data`,
    });
    plugin.settings.feeds.push(sampleFeed());
    await plugin.saveSettings();
    expect(plugin.hasUnsyncableStorage()).toBe(true);

    expect(await plugin.moveStorageToSyncedFolder()).toBe(true);

    const adapter = app.vault.adapter;
    expect(plugin.settings.storageFolder).toBe("rss-dashboard-mod-data/feeds");
    expect(plugin.settings.metadataStorageFolder).toBe("rss-dashboard-mod-data");
    expect(
      await adapter.exists("rss-dashboard-mod-data/feeds/feed-1.json"),
    ).toBe(true);
    const userState = JSON.parse(
      await adapter.read("rss-dashboard-mod-data/user-state.json"),
    ) as { states: Record<string, { read?: boolean; starred?: boolean }> };
    expect(Object.values(userState.states)[0]).toMatchObject({
      read: true,
      starred: true,
    });
    expect(plugin.hasUnsyncableStorage()).toBe(false);
  });

  it("leaves storage that already syncs where it is", async () => {
    const plugin = await launch(App.createMock(), {
      ...JSON.parse(JSON.stringify(DEFAULT_SETTINGS)),
      storageMode: "vault-shards-v2",
      storageFolder: "RSS/feeds",
      metadataStorageFolder: "RSS",
    });

    expect(await plugin.moveStorageToSyncedFolder()).toBe(false);
    expect(plugin.settings.storageFolder).toBe("RSS/feeds");
  });
});
