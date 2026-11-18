/**
 * Article state with one file per device. Obsidian Sync keeps only the newest
 * copy of a file two devices change, so a single shared user-state.json lost
 * one device's read marks whenever the other saved first. Each device now
 * writes its own file, and every device's file is merged, newest change
 * first.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "obsidian";
import {
  FeedStorageRepository,
  mergeUserStateSources,
} from "../../../src/services/feed-storage-repository";
import {
  DEFAULT_SETTINGS,
  type Feed,
  type FeedItem,
  type RssDashboardSettings,
} from "../../../src/types/types";

const FOLDER = "Utilities/RSS Reader";

function item(guid: string): FeedItem {
  return {
    title: guid,
    link: `https://example.com/${guid}`,
    description: "",
    pubDate: "2026-10-01T00:00:00Z",
    guid,
    read: false,
    starred: false,
    tags: [],
    feedTitle: "Feed",
    feedUrl: "https://example.com/feed.xml",
    coverImage: "",
  };
}

/** One device's view: its own settings object over the shared vault. */
function device(app: App, deviceId: string) {
  const settings = JSON.parse(
    JSON.stringify(DEFAULT_SETTINGS),
  ) as RssDashboardSettings;
  settings.storageMode = "vault-shards-v2";
  settings.storageFolder = `${FOLDER}/feeds`;
  settings.metadataStorageFolder = FOLDER;
  settings.feeds = [
    {
      title: "Feed",
      url: "https://example.com/feed.xml",
      folder: "",
      feedId: "feed-1",
      items: [item("a"), item("b"), item("c")],
      lastUpdated: 0,
    } as Feed,
  ];
  const repository = new FeedStorageRepository(app, { deviceId });
  const article = (guid: string) =>
    settings.feeds[0].items.find((entry) => entry.guid === guid)!;
  return { settings, repository, article };
}

async function readJson(app: App, path: string) {
  return JSON.parse(await app.vault.adapter.read(path)) as {
    states: Record<string, { read?: boolean; starred?: boolean; updatedAt?: number }>;
  };
}

let app: App;

beforeEach(async () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-05T09:00:00Z"));
  app = App.createMock();
  await app.vault.adapter.mkdir(`${FOLDER}/feeds`);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("article state with a file per device", () => {
  it("writes only this device's own file", async () => {
    const desktop = device(app, "desktop-1");
    desktop.article("a").read = true;

    await desktop.repository.saveUserStateFromFeeds(desktop.settings);

    expect(await app.vault.adapter.exists(`${FOLDER}/user-state.desktop-1.json`)).toBe(true);
    expect(await app.vault.adapter.exists(`${FOLDER}/user-state.json`)).toBe(false);
    expect((await readJson(app, `${FOLDER}/user-state.desktop-1.json`)).states["feed-1:a"]).toMatchObject({
      read: true,
      updatedAt: Date.now(),
    });
  });

  it("keeps the phone's read marks when the desktop saves before they arrive", async () => {
    const desktop = device(app, "desktop-1");
    const phone = device(app, "mobile-1");
    await desktop.repository.hydrateSettings(desktop.settings);
    await phone.repository.hydrateSettings(phone.settings);

    // The phone marks everything read.
    vi.setSystemTime(new Date("2026-11-05T09:01:00Z"));
    for (const guid of ["a", "b", "c"]) phone.article(guid).read = true;
    await phone.repository.saveUserStateFromFeeds(phone.settings);

    // The desktop, still showing them unread, stars one and saves.
    vi.setSystemTime(new Date("2026-11-05T09:02:00Z"));
    desktop.article("c").starred = true;
    await desktop.repository.saveUserStateFromFeeds(desktop.settings);

    // Both files survive; reloading the desktop shows the phone's reads.
    const reloaded = device(app, "desktop-1");
    await reloaded.repository.hydrateSettings(reloaded.settings);
    expect(reloaded.article("a").read).toBe(true);
    expect(reloaded.article("b").read).toBe(true);
    expect(reloaded.article("c")).toMatchObject({ read: true, starred: true });

    // And the phone sees the desktop's star.
    const phoneReloaded = device(app, "mobile-1");
    await phoneReloaded.repository.hydrateSettings(phoneReloaded.settings);
    expect(phoneReloaded.article("c")).toMatchObject({ read: true, starred: true });
  });

  it("keeps the phone's read when the desktop stars the article before the phone's file arrives", async () => {
    const desktop = device(app, "desktop-1");
    await desktop.repository.hydrateSettings(desktop.settings);

    // The desktop stars article a while the phone's file is still on its way.
    vi.setSystemTime(new Date("2026-11-05T09:02:00Z"));
    desktop.article("a").starred = true;
    await desktop.repository.saveUserStateFromFeeds(desktop.settings);

    // The phone had marked it read a minute earlier; its file arrives now.
    await app.vault.adapter.write(
      `${FOLDER}/user-state.mobile-1.json`,
      JSON.stringify({
        version: 3,
        states: {
          "feed-1:a": {
            read: true,
            updatedAt: Date.parse("2026-11-05T09:01:00Z"),
          },
        },
      }),
    );

    const reloaded = device(app, "desktop-1");
    await reloaded.repository.hydrateSettings(reloaded.settings);
    expect(reloaded.article("a")).toMatchObject({ read: true, starred: true });
  });

  it("lets the newer change win when both devices change the same article", async () => {
    const desktop = device(app, "desktop-1");
    const phone = device(app, "mobile-1");
    await desktop.repository.hydrateSettings(desktop.settings);
    await phone.repository.hydrateSettings(phone.settings);

    vi.setSystemTime(new Date("2026-11-05T09:01:00Z"));
    phone.article("a").read = true;
    await phone.repository.saveUserStateFromFeeds(phone.settings);

    vi.setSystemTime(new Date("2026-11-05T09:05:00Z"));
    await desktop.repository.hydrateSettings(desktop.settings);
    desktop.article("a").read = false;
    desktop.article("a").starred = true;
    await desktop.repository.saveUserStateFromFeeds(desktop.settings);

    const reloaded = device(app, "mobile-1");
    await reloaded.repository.hydrateSettings(reloaded.settings);
    expect(reloaded.article("a")).toMatchObject({ read: false, starred: true });
  });

  it("still reads the shared user-state.json from before per-device files", async () => {
    await app.vault.adapter.write(
      `${FOLDER}/user-state.json`,
      JSON.stringify({ version: 3, states: { "feed-1:b": { read: true } } }),
    );
    const desktop = device(app, "desktop-1");

    await desktop.repository.hydrateSettings(desktop.settings);

    expect(desktop.article("b").read).toBe(true);
  });

  it("skips another device's half-synced file instead of failing", async () => {
    await app.vault.adapter.write(`${FOLDER}/user-state.mobile-1.json`, "{\"version\": 3, \"sta");
    const desktop = device(app, "desktop-1");
    desktop.article("a").read = true;

    await desktop.repository.saveUserStateFromFeeds(desktop.settings);

    expect(desktop.repository.isUserStateUnreadable()).toBe(false);
    expect((await readJson(app, `${FOLDER}/user-state.desktop-1.json`)).states["feed-1:a"]).toMatchObject({ read: true });
  });

  it("does not rewrite its own file when nothing changed", async () => {
    const desktop = device(app, "desktop-1");
    desktop.article("a").read = true;
    await desktop.repository.saveUserStateFromFeeds(desktop.settings);
    const write = vi.spyOn(app.vault.adapter, "write");

    vi.setSystemTime(new Date("2026-11-05T10:00:00Z"));
    await desktop.repository.saveUserStateFromFeeds(desktop.settings);

    expect(write).not.toHaveBeenCalled();
  });

  it("reports another device's file as changed, but not its own", async () => {
    const desktop = device(app, "desktop-1");
    desktop.article("a").read = true;
    await desktop.repository.saveUserStateFromFeeds(desktop.settings);
    const ownPath = `${FOLDER}/user-state.desktop-1.json`;
    const phonePath = `${FOLDER}/user-state.mobile-1.json`;

    expect(await desktop.repository.hasUserStateChangedOnDisk(desktop.settings, ownPath)).toBe(false);

    await app.vault.adapter.write(
      phonePath,
      JSON.stringify({ version: 3, states: { "feed-1:b": { read: true, updatedAt: 5 } } }),
    );
    expect(await desktop.repository.hasUserStateChangedOnDisk(desktop.settings, phonePath)).toBe(true);
  });
});

describe("read-through marks for articles only one device has", () => {
  function feedWith(items: FeedItem[]) {
    return [
      {
        title: "Feed",
        url: "https://example.com/feed.xml",
        folder: "",
        feedId: "feed-1",
        items,
        lastUpdated: 0,
      } as Feed,
    ];
  }

  function dated(guid: string, day: string): FeedItem {
    return { ...item(guid), pubDate: `2026-10-${day}T00:00:00Z` };
  }

  it("marks read an old article only the desktop has, once the phone reads everything it has", async () => {
    const phone = device(app, "mobile-1");
    phone.settings.feeds = feedWith([dated("new", "20"), dated("mid", "10")]);
    await phone.repository.hydrateSettings(phone.settings);
    vi.setSystemTime(new Date("2026-11-05T09:01:00Z"));
    for (const entry of phone.settings.feeds[0].items) entry.read = true;
    await phone.repository.saveUserStateFromFeeds(phone.settings);

    // The desktop also holds an older post the phone never fetched, and a
    // newer one the phone hasn't fetched yet.
    const desktop = device(app, "desktop-1");
    desktop.settings.feeds = feedWith([
      dated("new", "20"),
      dated("mid", "10"),
      dated("old", "01"),
      dated("newer", "25"),
    ]);
    await desktop.repository.hydrateSettings(desktop.settings);

    expect(desktop.article("old").read).toBe(true);
    expect(desktop.article("mid").read).toBe(true);
    expect(desktop.article("newer").read).toBe(false);

    // The next save records it, so it reaches the desktop's own file too.
    await desktop.repository.saveUserStateFromFeeds(desktop.settings);
    expect(
      (await readJson(app, `${FOLDER}/user-state.desktop-1.json`)).states["feed-1:old"],
    ).toMatchObject({ read: true });
  });

  it("leaves an article marked unread after the mark unread", async () => {
    const phone = device(app, "mobile-1");
    phone.settings.feeds = feedWith([dated("a", "20")]);
    await phone.repository.hydrateSettings(phone.settings);
    vi.setSystemTime(new Date("2026-11-05T09:01:00Z"));
    phone.settings.feeds[0].items[0].read = true;
    await phone.repository.saveUserStateFromFeeds(phone.settings);

    const desktop = device(app, "desktop-1");
    desktop.settings.feeds = feedWith([dated("a", "20"), dated("b", "05")]);
    await desktop.repository.hydrateSettings(desktop.settings);
    expect(desktop.article("b").read).toBe(true);

    // Later, on the desktop, the user marks b unread to come back to it.
    vi.setSystemTime(new Date("2026-11-05T10:00:00Z"));
    await desktop.repository.saveUserStateFromFeeds(desktop.settings);
    desktop.article("b").read = false;
    await desktop.repository.saveUserStateFromFeeds(desktop.settings);

    const reloaded = device(app, "desktop-1");
    reloaded.settings.feeds = feedWith([dated("a", "20"), dated("b", "05")]);
    await reloaded.repository.hydrateSettings(reloaded.settings);
    expect(reloaded.article("b").read).toBe(false);
  });

  it("keeps the furthest read-through point across devices", () => {
    const merged = mergeUserStateSources([
      {
        file: { version: 3, states: {}, readThroughByFeedId: { f: { through: 10, recordedAt: 50 } } },
        modifiedAt: 0,
        isOwn: false,
      },
      {
        file: { version: 3, states: {}, readThroughByFeedId: { f: { through: 20, recordedAt: 40 } } },
        modifiedAt: 0,
        isOwn: true,
      },
    ]);

    expect(merged.readThroughByFeedId?.f).toEqual({ through: 20, recordedAt: 40 });
  });
});

describe("mergeUserStateSources()", () => {
  it("keeps each article's newest edit; an entry without edit times counts as 0", () => {
    const merged = mergeUserStateSources([
      {
        // An older version rewrote this file just now (modified 1000), but
        // its entries carry no edit times.
        file: { version: 3, states: { "f:a": { read: true }, "f:b": { read: true, updatedAt: 50 }, "f:c": { starred: true } } },
        modifiedAt: 1_000,
        isOwn: false,
      },
      {
        file: { version: 3, states: { "f:a": { read: false, updatedAt: 90 }, "f:b": { read: false, updatedAt: 60 } } },
        modifiedAt: 200,
        isOwn: true,
      },
    ]);

    expect(merged.states["f:a"]).toMatchObject({ read: false, changedAt: { read: 90 } });
    expect(merged.states["f:b"]).toMatchObject({ read: false, changedAt: { read: 60 } });
    // ...but still fills a gap no timed entry covers.
    expect(merged.states["f:c"]).toMatchObject({ starred: true });
  });

  it("merges field by field, so a star on one device keeps a read from another", () => {
    const merged = mergeUserStateSources([
      {
        file: {
          version: 3,
          states: { "f:a": { read: true, changedAt: { read: 10, starred: 10 } } },
        },
        modifiedAt: 0,
        isOwn: false,
      },
      {
        file: {
          version: 3,
          states: {
            "f:a": { read: false, starred: true, changedAt: { read: 0, starred: 20 } },
          },
        },
        modifiedAt: 0,
        isOwn: true,
      },
    ]);

    expect(merged.states["f:a"]).toMatchObject({ read: true, starred: true });
  });

  it("prefers this device's entry on a tie", () => {
    const merged = mergeUserStateSources([
      { file: { version: 3, states: { "f:a": { read: false, updatedAt: 5 } } }, modifiedAt: 0, isOwn: true },
      { file: { version: 3, states: { "f:a": { read: true, updatedAt: 5 } } }, modifiedAt: 0, isOwn: false },
    ]);

    expect(merged.states["f:a"]?.read).toBe(false);
  });
});

describe("a tablet that syncs three days late", () => {
  const D = (day: number) => Date.parse("2026-11-01T00:00:00Z") + day * 24 * 60 * 60 * 1000;
  const tabletPath = `${FOLDER}/user-state.tablet-1.json`;

  it("cannot undo a read mark made on the desktop yesterday", async () => {
    const desktop = device(app, "desktop-1");
    await desktop.repository.hydrateSettings(desktop.settings);
    vi.setSystemTime(D(2));
    desktop.article("a").read = true;
    await desktop.repository.saveUserStateFromFeeds(desktop.settings);

    // Written on the tablet on day 0.5 (it marked a unread then), synced in
    // only now, on day 3.
    vi.setSystemTime(D(3));
    await app.vault.adapter.write(
      tabletPath,
      JSON.stringify({
        version: 3,
        states: {
          "feed-1:a": { read: false, updatedAt: D(0.5), changedAt: { read: D(0.5) } },
        },
      }),
    );

    const reloaded = device(app, "desktop-1");
    await reloaded.repository.hydrateSettings(reloaded.settings);
    expect(reloaded.article("a").read).toBe(true);
  });

  it("cannot undo, with an old read-through mark, an unread made on the desktop yesterday", async () => {
    const desktop = device(app, "desktop-1");
    await desktop.repository.hydrateSettings(desktop.settings);
    vi.setSystemTime(D(1));
    desktop.article("a").read = true;
    await desktop.repository.saveUserStateFromFeeds(desktop.settings);
    vi.setSystemTime(D(2));
    desktop.article("a").read = false;
    await desktop.repository.saveUserStateFromFeeds(desktop.settings);

    // The tablet read everything on day 0.5; its file, with a mark dated by
    // those reads, arrives on day 3.
    vi.setSystemTime(D(3));
    await app.vault.adapter.write(
      tabletPath,
      JSON.stringify({
        version: 3,
        states: {
          "feed-1:a": { read: true, updatedAt: D(0.5), changedAt: { read: D(0.5) } },
          "feed-1:b": { read: true, updatedAt: D(0.5), changedAt: { read: D(0.5) } },
          "feed-1:c": { read: true, updatedAt: D(0.5), changedAt: { read: D(0.5) } },
        },
        readThroughByFeedId: {
          "feed-1": { through: Date.parse("2026-10-01T00:00:00Z"), recordedAt: D(0.5) },
        },
      }),
    );

    const reloaded = device(app, "desktop-1");
    await reloaded.repository.hydrateSettings(reloaded.settings);
    expect(reloaded.article("a").read).toBe(false);
    expect(reloaded.article("b").read).toBe(true);
  });

  it("dates its read-through mark by when the reads were made, not when it saves", async () => {
    const tablet = device(app, "tablet-1");
    await tablet.repository.hydrateSettings(tablet.settings);
    vi.setSystemTime(D(0.5));
    for (const guid of ["a", "b", "c"]) tablet.article(guid).read = true;
    await tablet.repository.saveUserStateFromFeeds(tablet.settings);

    vi.setSystemTime(D(3));
    tablet.article("a").starred = true;
    await tablet.repository.saveUserStateFromFeeds(tablet.settings);

    const file = JSON.parse(await app.vault.adapter.read(tabletPath)) as {
      readThroughByFeedId?: Record<string, { recordedAt: number }>;
    };
    expect(file.readThroughByFeedId?.["feed-1"]?.recordedAt).toBe(D(0.5));
  });
});
