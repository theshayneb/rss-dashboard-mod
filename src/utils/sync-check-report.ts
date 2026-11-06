import type { UserStateDiskReport } from "../services/feed-storage-repository";

export interface SyncCheckInput {
  version: string;
  isMobile: boolean;
  storageMode: string;
  storageFolder: string;
  feedCount: number;
  unloadedFeedCount: number;
  userState: UserStateDiskReport;
  checkedAt: Date;
}

/**
 * Plain-text sync check, to compare between devices: what this device shows
 * against the article state file Obsidian Sync carries, and what that
 * suggests.
 */
export function formatSyncCheckReport(input: SyncCheckInput): string {
  const state = input.userState;
  const fileLine =
    state.status === "ok"
      ? "found"
      : state.status === "missing"
        ? "MISSING"
        : "UNREADABLE";
  const lines = [
    "RSS Reader sync check",
    `Version: ${input.version} (${input.isMobile ? "mobile" : "desktop"})`,
    `Checked: ${input.checkedAt.toLocaleString()}`,
    `Storage mode: ${input.storageMode}`,
    `Feeds folder: ${input.storageFolder}`,
    `Article state file: ${state.path} (${fileLine})`,
    `File last changed: ${
      state.modifiedAt ? new Date(state.modifiedAt).toLocaleString() : "n/a"
    }`,
    ...(state.sourceFiles.length > 0
      ? [
          "Files read:",
          ...state.sourceFiles.map(
            (file) =>
              `  ${file.path.split("/").pop() ?? file.path}${file.isOwn ? " (this device)" : ""}: ${
                file.unreadable
                  ? "UNREADABLE, skipped"
                  : `${file.entryCount} entries, changed ${new Date(file.modifiedAt).toLocaleString()}`
              }`,
          ),
        ]
      : []),
    `Entries in file: ${state.entryCount} (${state.readEntryCount} marked read)`,
    `Feeds read through by a device: ${state.readThroughFeedCount}`,
    `Entries for feeds this device doesn't have: ${state.entriesForUnknownFeeds}`,
    `Feeds: ${input.feedCount} (${input.unloadedFeedCount} with no articles loaded)`,
    `Articles on this device: ${state.loadedItemCount} (${state.unreadItemCount} unread)`,
    `Unread here but read in the file: ${state.unreadButReadOnDisk}`,
    `Unread here with no entry in the file: ${state.unreadWithNoEntryOnDisk}`,
    `  ...of which the file has under another feed ID: ${state.unreadFoundUnderOtherFeedId}`,
    `Unread here and unread in the file: ${state.unreadAndUnreadOnDisk}`,
    ...(state.samplesWithNoEntry.length > 0
      ? [
          "Examples with no entry (feed | key):",
          ...state.samplesWithNoEntry.map((sample) => `  ${sample}`),
        ]
      : []),
    "",
    "What this suggests:",
    ...suggestions(input),
  ];
  return lines.join("\n");
}

function suggestions(input: SyncCheckInput): string[] {
  const state = input.userState;
  const found: string[] = [];

  if (input.storageMode !== "vault-shards-v2") {
    found.push(
      "- This storage mode can't keep read state in sync. Switch to shard storage v2 in settings.",
    );
  }
  if (state.status === "missing") {
    found.push(
      "- There's no article state file on this device. Turn on \"Sync all other types\" in Obsidian's Sync settings on every device, then wait for \"Fully synced\".",
    );
  }
  if (state.status === "unreadable") {
    found.push(
      "- The article state file can't be read. It may be half-synced; wait for \"Fully synced\" and check again.",
    );
  }
  if (state.unreadButReadOnDisk > 0) {
    found.push(
      `- ${state.unreadButReadOnDisk} articles are read in the file but not on screen. Tap "Reload from disk".`,
    );
  }
  if (state.unreadFoundUnderOtherFeedId > 0) {
    found.push(
      `- ${state.unreadFoundUnderOtherFeedId} unread articles are in the file under a different feed ID, so the devices give the same feeds different IDs.`,
    );
  } else if (
    state.entriesForUnknownFeeds > 0 &&
    state.unreadWithNoEntryOnDisk > 0
  ) {
    found.push(
      "- The file has entries for feeds this device doesn't know, so the devices may give the same feeds different IDs. Compare this report from both devices.",
    );
  }
  if (
    state.status === "ok" &&
    state.unreadWithNoEntryOnDisk > 0 &&
    state.entriesForUnknownFeeds === 0
  ) {
    found.push(
      `- ${state.unreadWithNoEntryOnDisk} unread articles aren't in the file at all: the other device either never had them or its changes haven't arrived. Check "Sync all other types" is on for both devices, and compare "File last changed" on both.`,
    );
  }
  if (state.unreadAndUnreadOnDisk > 0) {
    found.push(
      `- ${state.unreadAndUnreadOnDisk} unread articles are also unread in the file. If you marked them read, a save from a device that still had them unread replaced that.`,
    );
  }
  if (found.length === 0) {
    found.push("- Read state on this device matches the file.");
  }
  return found;
}
