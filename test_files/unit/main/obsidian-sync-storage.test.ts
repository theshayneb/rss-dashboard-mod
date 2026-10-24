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
  function settingsWith(overrides: Record<string, unknown>) {
    return { ...JSON.parse(JSON.stringify(DEFAULT_SETTINGS)), ...overrides };
  }

  it("reloads settings when another device changed data.json", async () => {
    vi.useFakeTimers();
    const plugin = await launch(App.createMock(), settingsWith({}));
    const reload = vi.spyOn(plugin, "loadSettings").mockResolvedValue();
    plugin.loadData = vi
      .fn()
      .mockResolvedValue(settingsWith({ refreshInterval: 240 }));

    await plugin.onExternalSettingsChange();
    await vi.advanceTimersByTimeAsync(2000);

    expect(reload).toHaveBeenCalledTimes(1);
  });

  it("ignores a copy that differs only by its sync stamp, so the dashboard is not redrawn", async () => {
    vi.useFakeTimers();
    const plugin = await launch(
      App.createMock(),
      settingsWith({ _syncNonce: "1-1", _syncPad: "pad" }),
    );
    const reload = vi.spyOn(plugin, "loadSettings").mockResolvedValue();
    plugin.loadData = vi
      .fn()
      .mockResolvedValue(
        settingsWith({ _syncNonce: "2-7", _syncPad: "longer pad" }),
      );

    await plugin.onExternalSettingsChange();
    await vi.advanceTimersByTimeAsync(2000);

    expect(reload).not.toHaveBeenCalled();
  });

  it("ignores the change its own save just wrote", async () => {
    vi.useFakeTimers();
    const plugin = await launch(App.createMock(), settingsWith({}));
    const reload = vi.spyOn(plugin, "loadSettings").mockResolvedValue();
    plugin.loadData = vi
      .fn()
      .mockResolvedValue(settingsWith({ refreshInterval: 240 }));

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

describe("article state changed by another device", () => {
  const userStatePath = "Utilities/RSS Reader/user-state.json";

  async function startWatching(app: App) {
    const handlers: Record<string, (...args: unknown[]) => void> = {};
    app.vault.on = vi.fn(
      (event: string, callback: (...args: unknown[]) => void) => {
        handlers[event] = callback;
        return {};
      },
    ) as never;
    const plugin = new RssDashboardPlugin(app, manifest());
    plugin.loadData = vi.fn().mockResolvedValue({
      ...JSON.parse(JSON.stringify(DEFAULT_SETTINGS)),
      storageMode: "vault-shards-v2",
      storageFolder: "Utilities/RSS Reader/feeds",
      metadataStorageFolder: "Utilities/RSS Reader",
    });
    plugin.saveData = vi.fn().mockResolvedValue(undefined);
    await plugin.onload();
    plugin.settings.feeds.push(sampleFeed());
    await plugin.saveSettings();
    const reload = vi.spyOn(plugin, "loadSettings").mockResolvedValue();
    // Let the watcher's suppression of the plugin's own save expire.
    (plugin as unknown as { suppressWatcherUntil: number }).suppressWatcherUntil = 0;
    return { plugin, reload, modify: () => handlers.modify?.({ path: userStatePath }) };
  }

  async function settle(): Promise<void> {
    for (let i = 0; i < 10; i++) await Promise.resolve();
    await vi.advanceTimersByTimeAsync(2000);
  }

  it("reloads when user-state.json in the data folder brings a real change", async () => {
    vi.useFakeTimers();
    const app = App.createMock();
    const { reload, modify } = await startWatching(app);
    const file = JSON.parse(await app.vault.adapter.read(userStatePath)) as {
      states: Record<string, unknown>;
    };
    file.states = { "feed-1:https://example.com/1": { read: false } };
    await app.vault.adapter.write(userStatePath, JSON.stringify(file));

    modify();
    await settle();

    expect(reload).toHaveBeenCalledTimes(1);
  });

  it("does not reload for a copy that differs only by its sync stamp", async () => {
    vi.useFakeTimers();
    const app = App.createMock();
    const { reload, modify } = await startWatching(app);
    const file = JSON.parse(await app.vault.adapter.read(userStatePath)) as Record<
      string,
      unknown
    >;
    file._syncNonce = "999-1";
    await app.vault.adapter.write(userStatePath, JSON.stringify(file));

    modify();
    await settle();

    expect(reload).not.toHaveBeenCalled();
  });
});
