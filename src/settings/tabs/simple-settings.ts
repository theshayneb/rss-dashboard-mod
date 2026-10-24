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
  renderSyncAcrossDevicesSetting,
  type StorageSettingsPluginLike,
} from "./storage-settings-tab";

export type SimpleSettingsPlugin = Pick<
  GeneralSettingsPlugin,
  "settings" | "saveSettings"
> &
  Pick<ArticleSavingPluginLike, "settings"> &
  StorageSettingsPluginLike;

export function renderSimpleSettings(
  containerEl: HTMLElement,
  plugin: SimpleSettingsPlugin,
  actions: { onManageFeeds: () => void; onShowAllSettings: () => void },
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
  renderTaskNoteSetting(containerEl, plugin);
  renderSyncAcrossDevicesSetting(containerEl, plugin);

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
