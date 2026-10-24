import { beforeEach, describe, expect, it, vi } from "vitest";
import * as obsidian from "obsidian";
import { installObsidianDomPolyfills } from "../test-dom-polyfills";
import type RssDashboardPlugin from "../../../main";

vi.mock("../../../src/settings/tabs/general-settings-tab", () => ({
  renderGeneralSettingsTab: vi.fn(),
}));
vi.mock("../../../src/settings/tabs/storage-settings-tab", () => ({
  renderStorageSettingsTab: vi.fn(),
}));
vi.mock("../../../src/settings/tabs/display-settings-tab", () => ({
  renderDisplaySettingsTab: vi.fn(),
}));
vi.mock("../../../src/settings/tabs/media-settings-tab", () => ({
  renderMediaSettingsTab: vi.fn(),
}));
vi.mock("../../../src/settings/tabs/article-saving-settings-tab", () => ({
  renderArticleSavingSettingsTab: vi.fn(),
}));
vi.mock("../../../src/settings/tabs/rules-settings-tab", () => ({
  renderRulesSettingsTab: vi.fn(),
}));
vi.mock("../../../src/settings/tabs/highlights-settings-tab", () => ({
  renderHighlightsSettingsTab: vi.fn(),
}));
vi.mock("../../../src/settings/tabs/import-export-settings-tab", () => ({
  renderImportExportSettingsTab: vi.fn(),
}));
vi.mock("../../../src/settings/tabs/tags-settings-tab", () => ({
  renderTagsSettingsTab: vi.fn(),
}));
vi.mock("../../../src/settings/tabs/sidebar-settings-tab", () => ({
  renderSidebarSettingsTab: vi.fn(),
}));
vi.mock("../../../src/settings/tabs/about-settings-tab", () => ({
  renderAboutTab: vi.fn(),
}));
vi.mock("../../../src/settings/tabs/simple-settings", () => ({
  renderSimpleSettings: vi.fn(),
}));

type SettingTab = InstanceType<
  typeof import("../../../src/settings/settings-tab").RssDashboardSettingTab
>;

/** Opens settings and clicks "Show all settings" on the simple page. */
async function showAllSettings(tab: SettingTab): Promise<void> {
  const simple = await import("../../../src/settings/tabs/simple-settings");
  tab.refresh();
  const calls = vi.mocked(simple.renderSimpleSettings).mock.calls;
  const actions = calls[calls.length - 1]?.[2];
  actions?.onShowAllSettings();
}

beforeEach(() => {
  installObsidianDomPolyfills();
  document.body.empty();
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

describe("RssDashboardSettingTab (orchestrator)", () => {
  it("renders tab bar + default General tab renderer", async () => {
    const { RssDashboardSettingTab } = await import(
      "../../../src/settings/settings-tab"
    );
    const general = await import("../../../src/settings/tabs/general-settings-tab");

    const app = obsidian.App.createMock();
    const plugin = { app } as unknown as RssDashboardPlugin;
    const tab = new RssDashboardSettingTab(app, plugin);

    tab.containerEl = document.body.appendChild(createDiv());
    await showAllSettings(tab);

    const tabButtons = Array.from(
      tab.containerEl.querySelectorAll(".rss-dashboard-settings-tab-btn"),
    );
    expect(tabButtons).toHaveLength(11);
    expect(tabButtons[0].textContent).toBe("General");

    expect(vi.mocked(general.renderGeneralSettingsTab)).toHaveBeenCalledTimes(1);
  });

  it("switches tabs on button click and via activateTab()", async () => {
    const { RssDashboardSettingTab } = await import(
      "../../../src/settings/settings-tab"
    );
    const rules = await import("../../../src/settings/tabs/rules-settings-tab");
    const about = await import("../../../src/settings/tabs/about-settings-tab");

    const app = obsidian.App.createMock();
    const plugin = { app } as unknown as RssDashboardPlugin;
    const tab = new RssDashboardSettingTab(app, plugin);
    tab.containerEl = document.body.appendChild(createDiv());

    await showAllSettings(tab);

    const aboutBtn = Array.from(
      tab.containerEl.querySelectorAll("button"),
    ).find((b) => b.textContent === "About") as HTMLButtonElement;
    aboutBtn.click();
    expect(vi.mocked(about.renderAboutTab)).toHaveBeenCalledTimes(1);

    tab.activateTab("Rules");
    expect(vi.mocked(rules.renderRulesSettingsTab)).toHaveBeenCalledTimes(1);

    const display = await import("../../../src/settings/tabs/display-settings-tab");
    tab.activateTab("Display", "Reader");
    expect(vi.mocked(display.renderDisplaySettingsTab)).toHaveBeenLastCalledWith(
      expect.any(HTMLDivElement),
      plugin,
      expect.any(Function),
      "Reader",
    );

    // Invalid tab name is ignored
    vi.mocked(rules.renderRulesSettingsTab).mockClear();
    tab.activateTab("Nope");
    expect(vi.mocked(rules.renderRulesSettingsTab)).toHaveBeenCalledTimes(0);
  });

  it("responds to 'rss-settings-refresh' event by re-rendering", async () => {
    const { RssDashboardSettingTab } = await import(
      "../../../src/settings/settings-tab"
    );
    const general = await import("../../../src/settings/tabs/general-settings-tab");

    const app = obsidian.App.createMock();
    const plugin = { app } as unknown as RssDashboardPlugin;
    const tab = new RssDashboardSettingTab(app, plugin);
    tab.containerEl = document.body.appendChild(createDiv());

    await showAllSettings(tab);
    expect(vi.mocked(general.renderGeneralSettingsTab)).toHaveBeenCalledTimes(1);

    const contentEl = tab.containerEl.querySelector(
      ".rss-dashboard-settings-tab-content",
    ) as HTMLDivElement;
    expect(contentEl).toBeTruthy();

    contentEl.dispatchEvent(new CustomEvent("rss-settings-refresh"));
    expect(vi.mocked(general.renderGeneralSettingsTab)).toHaveBeenCalledTimes(2);
  });

  it("refreshes the legacy settings renderer through its compatibility bridge", async () => {
    const { RssDashboardSettingTab } = await import(
      "../../../src/settings/settings-tab"
    );
    const general = await import("../../../src/settings/tabs/general-settings-tab");

    const app = obsidian.App.createMock();
    const plugin = { app } as unknown as RssDashboardPlugin;
    const tab = new RssDashboardSettingTab(app, plugin);
    tab.containerEl = document.body.appendChild(createDiv());

    await showAllSettings(tab);
    tab.refresh();

    expect(vi.mocked(general.renderGeneralSettingsTab)).toHaveBeenCalledTimes(2);
  });

  describe("simple settings page", () => {
    it("opens on the simple page instead of the tabs", async () => {
      const { RssDashboardSettingTab } = await import(
        "../../../src/settings/settings-tab"
      );
      const simple = await import("../../../src/settings/tabs/simple-settings");
      const general = await import(
        "../../../src/settings/tabs/general-settings-tab"
      );

      const app = obsidian.App.createMock();
      const plugin = { app } as unknown as RssDashboardPlugin;
      const tab = new RssDashboardSettingTab(app, plugin);
      tab.containerEl = document.body.appendChild(createDiv());

      tab.refresh();

      expect(vi.mocked(simple.renderSimpleSettings)).toHaveBeenCalledTimes(1);
      expect(vi.mocked(general.renderGeneralSettingsTab)).not.toHaveBeenCalled();
      expect(
        tab.containerEl.querySelector(".rss-dashboard-settings-tab-btn"),
      ).toBeNull();
    });

    it("goes back to the simple page from the tabs, and after closing", async () => {
      const { RssDashboardSettingTab } = await import(
        "../../../src/settings/settings-tab"
      );
      const simple = await import("../../../src/settings/tabs/simple-settings");

      const app = obsidian.App.createMock();
      const plugin = { app } as unknown as RssDashboardPlugin;
      const tab = new RssDashboardSettingTab(app, plugin);
      tab.containerEl = document.body.appendChild(createDiv());

      await showAllSettings(tab);
      Array.from(tab.containerEl.querySelectorAll("button"))
        .find((b) => b.textContent === "Back to simple settings")
        ?.click();
      expect(vi.mocked(simple.renderSimpleSettings)).toHaveBeenCalledTimes(2);

      await showAllSettings(tab);
      tab.hide();
      tab.refresh();
      expect(vi.mocked(simple.renderSimpleSettings)).toHaveBeenCalledTimes(4);
    });

    it("opens a tab directly when another part of the plugin asks for it", async () => {
      const { RssDashboardSettingTab } = await import(
        "../../../src/settings/settings-tab"
      );
      const display = await import(
        "../../../src/settings/tabs/display-settings-tab"
      );

      const app = obsidian.App.createMock();
      const plugin = { app } as unknown as RssDashboardPlugin;
      const tab = new RssDashboardSettingTab(app, plugin);
      tab.containerEl = document.body.appendChild(createDiv());

      tab.activateTab("Display", "Reader");

      expect(vi.mocked(display.renderDisplaySettingsTab)).toHaveBeenCalledTimes(1);
    });
  });
});

