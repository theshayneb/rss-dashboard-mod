/**
 * The default settings page: feeds, refresh period, to-do note, and sync
 * status, with the full tabbed settings one click away.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderSimpleSettings } from "../../../src/settings/tabs/simple-settings";
import {
  DEFAULT_SETTINGS,
  type RssDashboardSettings,
} from "../../../src/types/types";
import { installObsidianDomPolyfills } from "../test-dom-polyfills";

function createPlugin() {
  return {
    settings: JSON.parse(
      JSON.stringify(DEFAULT_SETTINGS),
    ) as RssDashboardSettings,
    saveSettings: vi.fn(async () => {}),
    settingTab: null,
    hasUnsyncableStorage: vi.fn(() => false),
    isInDataFolder: vi.fn(() => true),
    moveStorageToDataFolder: vi.fn(async () => true),
  };
}

function settingNames(containerEl: HTMLElement): string[] {
  return Array.from(containerEl.querySelectorAll(".setting-item-name")).map(
    (el) => el.textContent ?? "",
  );
}

function button(containerEl: HTMLElement, text: string) {
  return Array.from(containerEl.querySelectorAll("button")).find(
    (b) => b.textContent === text,
  );
}

beforeEach(() => {
  installObsidianDomPolyfills();
  document.body.empty();
});

describe("renderSimpleSettings()", () => {
  it("shows only feeds, refresh period, to-do note, sync, and a way to everything else", () => {
    const containerEl = document.body.appendChild(createDiv());
    renderSimpleSettings(containerEl, createPlugin(), {
      onManageFeeds: vi.fn(),
      onShowAllSettings: vi.fn(),
    });

    expect(settingNames(containerEl)).toEqual([
      "Feeds",
      "Auto-refresh interval",
      "Save button adds a task to",
      "Data folder",
      "All settings",
    ]);
  });

  it("opens the feed manager and the full settings from their buttons", () => {
    const containerEl = document.body.appendChild(createDiv());
    const onManageFeeds = vi.fn();
    const onShowAllSettings = vi.fn();
    renderSimpleSettings(containerEl, createPlugin(), {
      onManageFeeds,
      onShowAllSettings,
    });

    button(containerEl, "Manage feeds")?.click();
    button(containerEl, "Show all settings")?.click();

    expect(onManageFeeds).toHaveBeenCalledTimes(1);
    expect(onShowAllSettings).toHaveBeenCalledTimes(1);
  });

  it("saves a new refresh period", async () => {
    const containerEl = document.body.appendChild(createDiv());
    const plugin = createPlugin();
    renderSimpleSettings(containerEl, plugin, {
      onManageFeeds: vi.fn(),
      onShowAllSettings: vi.fn(),
    });

    const select = containerEl.querySelector("select") as HTMLSelectElement;
    select.value = "60";
    select.dispatchEvent(new Event("change"));
    await Promise.resolve();

    expect(plugin.settings.refreshInterval).toBe(60);
    expect(plugin.saveSettings).toHaveBeenCalled();
  });
});
