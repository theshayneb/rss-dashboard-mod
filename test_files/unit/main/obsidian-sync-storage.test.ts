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

describe("moving storage to the Utilities/RSS Reader data folder", () => {
  it("rewrites shards and article state out of the plugin folder", async () => {
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

    expect(await plugin.moveStorageToDataFolder()).toBe(true);

    const adapter = app.vault.adapter;
    expect(plugin.settings.storageFolder).toBe("Utilities/RSS Reader/feeds");
    expect(plugin.settings.metadataStorageFolder).toBe("Utilities/RSS Reader");
    expect(
      await adapter.exists("Utilities/RSS Reader/feeds/feed-1.json"),
    ).toBe(true);
    const userState = JSON.parse(
      await adapter.read("Utilities/RSS Reader/user-state.json"),
    ) as { states: Record<string, { read?: boolean; starred?: boolean }> };
    expect(Object.values(userState.states)[0]).toMatchObject({
      read: true,
      starred: true,
    });
    expect(plugin.hasUnsyncableStorage()).toBe(false);
    expect(plugin.isInDataFolder()).toBe(true);
  });

  it("moves storage from another vault folder", async () => {
    const plugin = await launch(App.createMock(), {
      ...JSON.parse(JSON.stringify(DEFAULT_SETTINGS)),
      storageMode: "vault-shards-v2",
      storageFolder: "rss-dashboard-mod-data/feeds",
      metadataStorageFolder: "rss-dashboard-mod-data",
    });

    expect(await plugin.moveStorageToDataFolder()).toBe(true);
    expect(plugin.settings.storageFolder).toBe("Utilities/RSS Reader/feeds");
  });

  it("leaves storage already in the data folder where it is", async () => {
    const plugin = await launch(App.createMock(), {
      ...JSON.parse(JSON.stringify(DEFAULT_SETTINGS)),
      storageMode: "vault-shards-v2",
      storageFolder: "Utilities/RSS Reader/feeds",
      metadataStorageFolder: "Utilities/RSS Reader",
    });

    expect(await plugin.moveStorageToDataFolder()).toBe(false);
  });
});
