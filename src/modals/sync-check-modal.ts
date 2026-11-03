import { App, Modal, Notice, Setting } from "obsidian";
import { copyTextToClipboard } from "../utils/export-utils";

/** Shows the sync check report, with ways to copy it and to reload. */
export class SyncCheckModal extends Modal {
  constructor(
    app: App,
    private readonly report: string,
    private readonly onReload: () => Promise<void>,
  ) {
    super(app);
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();
    this.setTitle("Sync check");
    contentEl.createEl("p", {
      text: "Run this on each device and compare the reports.",
    });
    contentEl.createEl("textarea", {
      cls: "rss-dashboard-sync-check-report",
      text: this.report,
      attr: { readonly: "true", rows: "18" },
    });

    new Setting(contentEl)
      .addButton((button) =>
        button.setButtonText("Copy report").onClick(() => {
          void copyTextToClipboard(this.report).then((result) => {
            new Notice(
              result === "copied" ? "Report copied" : "Couldn't copy the report",
            );
          });
        }),
      )
      .addButton((button) =>
        button
          .setButtonText("Reload from disk")
          .setCta()
          .onClick(() => {
            void this.onReload().then(() => this.close());
          }),
      );
  }

  onClose(): void {
    this.contentEl.empty();
  }
}
