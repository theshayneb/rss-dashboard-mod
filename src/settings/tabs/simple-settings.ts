/**
 * The settings page shown by default: only what everyday use needs. The full
 * tabbed settings stay one click away.
 */
import { Setting } from "obsidian";
import {
  renderRefreshIntervalSetting,
  type GeneralSettingsPlugin,
} from "./general-settings-tab";
import {
  renderTaskNoteSetting,
  type ArticleSavingPluginLike,
} from "./article-saving-settings-tab";
import {
  renderDataFolderSetting,
  type StorageSettingsPluginLike,
} from "./storage-settings-tab";

export type SimpleSettingsPlugin = Pick<
  GeneralSettingsPlugin,
  "settings" | "saveSettings"
> &
  Pick<ArticleSavingPluginLike, "settings"> &
  StorageSettingsPluginLike & {
    deviceId: string;
    isBackgroundTasksEnabled(): boolean;
    setBackgroundTasksEnabled(enabled: boolean): void;
  };

export function renderSimpleSettings(
  containerEl: HTMLElement,
  plugin: SimpleSettingsPlugin,
  actions: {
    onManageFeeds: () => void;
    onCheckSync: () => void;
    onShowAllSettings: () => void;
  },
): void {
  new Setting(containerEl)
    .setName("Feeds")
    .setDesc("Add, edit, or remove the feeds you follow.")
    .addButton((button) =>
      button
        .setButtonText("Manage feeds")
        .setCta()
        .onClick(() => actions.onManageFeeds()),
    );

  renderRefreshIntervalSetting(containerEl, plugin);

  new Setting(containerEl)
    .setName("Run background tasks on this device")
    .setDesc(
      `Automatic refreshes, fetching, and automatic fixes run only on devices with this on, after Obsidian Sync has caught up. Turn it on for one always-on device; other devices refresh only when you ask, and get new articles through Sync. This device: ${plugin.deviceId}`,
    )
    .addToggle((toggle) =>
      toggle
        .setValue(plugin.isBackgroundTasksEnabled())
        .onChange((value) => plugin.setBackgroundTasksEnabled(value)),
    );
  renderTaskNoteSetting(containerEl, plugin);
  renderDataFolderSetting(containerEl, plugin);

  new Setting(containerEl)
    .setName("Sync check")
    .setDesc(
      "Compare this device's read state with the synced file, and reload it from disk.",
    )
    .addButton((button) =>
      button.setButtonText("Check sync").onClick(() => actions.onCheckSync()),
    );

  new Setting(containerEl)
    .setName("All settings")
    .setDesc(
      "Display, storage, import and export, tags, rules, and everything else.",
    )
    .addButton((button) =>
      button
        .setButtonText("Show all settings")
        .onClick(() => actions.onShowAllSettings()),
    );
}
