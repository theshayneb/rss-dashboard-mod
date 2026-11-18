/**
 * Per-device layout and refresh bookkeeping stays in Obsidian's per-device
 * local storage and out of every synced file.
 */
import { describe, expect, it } from "vitest";
import { App } from "obsidian";
import {
  DEFAULT_SETTINGS,
  type Feed,
  type RssDashboardSettings,
} from "../../../src/types/types";
import {
  applyDeviceState,
  extractDeviceState,
  isBackgroundTasksEnabled,
  loadDeviceState,
  saveDeviceState,
  setBackgroundTasksEnabled,
  stripDeviceState,
} from "../../../src/utils/device-state";

function settings(): RssDashboardSettings {
  const value = JSON.parse(JSON.stringify(DEFAULT_SETTINGS)) as RssDashboardSettings;
  value.feeds = [
    {
      feedId: "feed-1",
      title: "Feed",
      url: "https://example.com/feed.xml",
      folder: "",
      items: [],
      lastUpdated: 111,
      lastRefreshAttemptCompletedAt: 222,
      lastFetchError: "timeout",
    } as Feed,
  ];
  value.viewStyle = "card";
  value.allArticlesPageSize = 75;
  value.lastGlobalRefreshCompletedAt = 333;
  value.refreshInterval = 45;
  return value;
}

describe("stripDeviceState()", () => {
  it("leaves out layout and refresh bookkeeping, and keeps shared settings", () => {
    const stripped = stripDeviceState(settings()) as unknown as Record<string, unknown>;

    expect(stripped).not.toHaveProperty("viewStyle");
    expect(stripped).not.toHaveProperty("allArticlesPageSize");
    expect(stripped).not.toHaveProperty("lastGlobalRefreshCompletedAt");
    expect(stripped.refreshInterval).toBe(45);
    const [feed] = stripped.feeds as Record<string, unknown>[];
    expect(feed).not.toHaveProperty("lastUpdated");
    expect(feed).not.toHaveProperty("lastRefreshAttemptCompletedAt");
    expect(feed).not.toHaveProperty("lastFetchError");
    expect(feed).toMatchObject({ feedId: "feed-1", url: "https://example.com/feed.xml" });
  });
});

describe("saving and restoring device state", () => {
  it("puts this device's layout and refresh times back on loaded settings", () => {
    const app = App.createMock();
    saveDeviceState(app, settings());

    const loaded = settings();
    loaded.viewStyle = "list";
    loaded.allArticlesPageSize = 20;
    loaded.feeds[0].lastRefreshAttemptCompletedAt = 0;
    applyDeviceState(loaded, loadDeviceState(app));

    expect(loaded.viewStyle).toBe("card");
    expect(loaded.allArticlesPageSize).toBe(75);
    expect(loaded.feeds[0].lastRefreshAttemptCompletedAt).toBe(222);
  });

  it("extracts only per-device fields", () => {
    const state = extractDeviceState(settings());

    expect(state.settings).not.toHaveProperty("refreshInterval");
    expect(state.feeds["feed-1"]).toEqual({
      lastUpdated: 111,
      lastRefreshAttemptCompletedAt: 222,
      lastFetchError: "timeout",
    });
  });
});

describe("background tasks switch", () => {
  it("defaults on for desktop and off for phones and tablets", () => {
    expect(isBackgroundTasksEnabled(App.createMock(), true)).toBe(true);
    expect(isBackgroundTasksEnabled(App.createMock(), false)).toBe(false);
  });

  it("remembers the choice on this device", () => {
    const app = App.createMock();
    setBackgroundTasksEnabled(app, true);

    expect(isBackgroundTasksEnabled(app, false)).toBe(true);
  });
});
