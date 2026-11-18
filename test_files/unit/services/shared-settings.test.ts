/**
 * Shared settings merged by edit time across devices. A phone or tablet that
 * syncs hours or days late carries stale copies of everything it never
 * touched: those must never win over edits made meanwhile elsewhere.
 */
import { describe, expect, it } from "vitest";
import { App } from "obsidian";
import {
  DEFAULT_SETTINGS,
  type Feed,
  type RssDashboardSettings,
} from "../../../src/types/types";
import {
  applySharedEntries,
  flattenSharedSettings,
  legacyEntries,
  liveSharedValues,
  localSharedChanges,
  mergeSharedSources,
  type SharedEntry,
} from "../../../src/services/shared-settings";
import { SharedSettingsStore } from "../../../src/services/shared-settings-store";

const FOLDER = "Utilities/RSS Reader";
const DAY = 24 * 60 * 60 * 1000;

function feed(feedId: string, title = feedId): Feed {
  return {
    feedId,
    title,
    url: `https://example.com/${feedId}.xml`,
    folder: "",
    items: [],
    lastUpdated: 0,
  };
}

function settingsWith(feeds: Feed[]): RssDashboardSettings {
  const settings = JSON.parse(JSON.stringify(DEFAULT_SETTINGS)) as RssDashboardSettings;
  settings.feeds = feeds;
  return settings;
}

/**
 * One device: its settings in memory, what it last read or wrote, and its
 * settings file. `save` runs the read-merge-write the plugin does.
 */
function device(app: App, deviceId: string, initial: RssDashboardSettings) {
  const store = new SharedSettingsStore(app, deviceId);
  const state = {
    settings: initial,
    known: legacyEntries(initial),
  };
  const sync = async (now: number, legacy: Record<string, SharedEntry> = {}) => {
    const read = await store.readAll(FOLDER);
    if (read.status !== "ok") throw new Error("own file unreadable");
    const current = flattenSharedSettings(state.settings);
    const changes = localSharedChanges(state.known, current, now);
    const merged = {
      ...mergeSharedSources(
        [...read.sources, { entries: state.known, isOwn: false }],
        legacy,
      ),
      ...changes,
    };
    applySharedEntries(state.settings, merged);
    state.known = merged;
    const wrote =
      Object.keys(changes).length > 0 &&
      (await store.writeOwn(FOLDER, merged, read.ownFile));
    return { wrote };
  };
  return { state, sync, titles: () => state.settings.feeds.map((f) => f.title) };
}

describe("shared settings across a desktop, phone, and tablet", () => {
  it("keeps a feed added on the desktop when a stale tablet saves days later", async () => {
    const app = App.createMock();
    const start = settingsWith([feed("a")]);
    const desktop = device(app, "desktop", JSON.parse(JSON.stringify(start)));
    const tablet = device(app, "tablet", JSON.parse(JSON.stringify(start)));

    desktop.state.settings.feeds.push(feed("b"));
    await desktop.sync(10 * DAY);

    // Three days later the tablet, offline meanwhile, edits something else.
    tablet.state.settings.refreshInterval = 15;
    await tablet.sync(13 * DAY);

    await desktop.sync(14 * DAY);
    expect(desktop.titles()).toEqual(["a", "b"]);
    expect(desktop.state.settings.refreshInterval).toBe(15);
  });

  it("keeps a feed deleted when a device that still has it saves later", async () => {
    const app = App.createMock();
    const start = settingsWith([feed("a"), feed("b")]);
    const desktop = device(app, "desktop", JSON.parse(JSON.stringify(start)));
    const phone = device(app, "phone", JSON.parse(JSON.stringify(start)));

    desktop.state.settings.feeds = desktop.state.settings.feeds.filter(
      (f) => f.feedId !== "b",
    );
    await desktop.sync(10 * DAY);

    // The phone, not yet synced, renames feed a.
    phone.state.settings.feeds[0].title = "A (renamed on phone)";
    await phone.sync(11 * DAY);

    await desktop.sync(12 * DAY);
    expect(desktop.titles()).toEqual(["A (renamed on phone)"]);
    await phone.sync(12 * DAY);
    expect(phone.titles()).toEqual(["A (renamed on phone)"]);
  });

  it("keeps both edits when two devices change different settings", async () => {
    const app = App.createMock();
    const start = settingsWith([feed("a")]);
    const desktop = device(app, "desktop", JSON.parse(JSON.stringify(start)));
    const phone = device(app, "phone", JSON.parse(JSON.stringify(start)));

    desktop.state.settings.articleSaving.taskNotePath = "Tasks.md";
    await desktop.sync(1_000);
    phone.state.settings.feeds.push(feed("c"));
    await phone.sync(2_000);

    await desktop.sync(3_000);
    expect(desktop.titles()).toEqual(["a", "c"]);
    expect(desktop.state.settings.articleSaving.taskNotePath).toBe("Tasks.md");
  });

  it("lets the newer edit win when two devices change the same setting", async () => {
    const app = App.createMock();
    const start = settingsWith([]);
    const desktop = device(app, "desktop", JSON.parse(JSON.stringify(start)));
    const tablet = device(app, "tablet", JSON.parse(JSON.stringify(start)));

    tablet.state.settings.refreshInterval = 120;
    await tablet.sync(1 * DAY); // made three days ago, synced only now
    desktop.state.settings.refreshInterval = 30;
    await desktop.sync(3 * DAY);

    await desktop.sync(4 * DAY);
    await tablet.sync(4 * DAY);
    expect(desktop.state.settings.refreshInterval).toBe(30);
    expect(tablet.state.settings.refreshInterval).toBe(30);
  });

  it("does not let data.json from an older version override an edit", () => {
    const edited: Record<string, SharedEntry> = {
      "setting:refreshInterval": { v: 30, t: 5_000 },
    };
    const stale = legacyEntries(settingsWith([]));

    const merged = mergeSharedSources([{ entries: edited, isOwn: false }], stale);

    expect(merged["setting:refreshInterval"]).toEqual({ v: 30, t: 5_000 });
  });

  it("adds a feed that only data.json from an older version has", () => {
    const merged = mergeSharedSources([], legacyEntries(settingsWith([feed("old")])));

    expect(liveSharedValues(merged)).toHaveProperty("feed:old");
  });

  it("writes nothing when a merge brings no edit from this device", async () => {
    const app = App.createMock();
    const desktop = device(app, "desktop", settingsWith([feed("a")]));
    const phone = device(app, "phone", settingsWith([feed("a")]));
    desktop.state.settings.refreshInterval = 45;
    await desktop.sync(1_000);

    const result = await phone.sync(2_000);

    expect(result.wrote).toBe(false);
    expect(phone.state.settings.refreshInterval).toBe(45);
    expect(await app.vault.adapter.exists(`${FOLDER}/settings.phone.json`)).toBe(false);
  });
});

describe("flattenSharedSettings()", () => {
  it("leaves out per-device layout, refresh bookkeeping, and the data folder", () => {
    const settings = settingsWith([{ ...feed("a"), lastRefreshAttemptCompletedAt: 9 }]);
    settings.viewStyle = "card";

    const flat = flattenSharedSettings(settings);

    expect(flat).not.toHaveProperty("setting:viewStyle");
    expect(flat).not.toHaveProperty("setting:storageFolder");
    expect(flat["feed:a"]).not.toHaveProperty("lastRefreshAttemptCompletedAt");
    expect(flat).toHaveProperty("setting:refreshInterval");
  });

  it("round-trips folders, tags, and templates", () => {
    const settings = settingsWith([feed("a")]);
    settings.folders = [
      { name: "News", subfolders: [{ name: "Tech", subfolders: [] }] },
      { name: "Fun", subfolders: [] },
    ];
    settings.availableTags = [{ name: "later", color: "#f00" }];
    settings.articleSaving.savedTemplates = [{ id: "t1", name: "T", template: "x" }];
    const entries = legacyEntries(settings);

    const restored = settingsWith([feed("a")]);
    applySharedEntries(restored, entries);

    expect(restored.folders).toEqual(settings.folders);
    expect(restored.availableTags).toEqual(settings.availableTags);
    expect(restored.articleSaving.savedTemplates).toEqual(
      settings.articleSaving.savedTemplates,
    );
  });
});
