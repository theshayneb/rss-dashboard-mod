import { describe, expect, it } from "vitest";
import {
  formatSyncCheckReport,
  type SyncCheckInput,
} from "../../../src/utils/sync-check-report";

function input(
  userState: Partial<SyncCheckInput["userState"]> = {},
  overrides: Partial<SyncCheckInput> = {},
): SyncCheckInput {
  return {
    version: "2.7.12",
    isMobile: false,
    storageMode: "vault-shards-v2",
    storageFolder: "Utilities/RSS Reader/feeds",
    feedCount: 4,
    unloadedFeedCount: 0,
    checkedAt: new Date(0),
    userState: {
      path: "Utilities/RSS Reader/user-state.json",
      status: "ok",
      modifiedAt: 0,
      entryCount: 10,
      readEntryCount: 10,
      entriesForUnknownFeeds: 0,
      loadedItemCount: 20,
      unreadItemCount: 0,
      unreadButReadOnDisk: 0,
      unreadWithNoEntryOnDisk: 0,
      ...userState,
    },
    ...overrides,
  };
}

describe("formatSyncCheckReport()", () => {
  it("says read state matches when nothing is off", () => {
    expect(formatSyncCheckReport(input())).toContain(
      "Read state on this device matches the file.",
    );
  });

  it("tells the user to reload when the file has read marks not on screen", () => {
    const report = formatSyncCheckReport(input({ unreadButReadOnDisk: 300 }));
    expect(report).toContain("Unread here but read in the file: 300");
    expect(report).toContain('Tap "Reload from disk"');
  });

  it("points at Obsidian's Sync settings when the file is missing", () => {
    expect(
      formatSyncCheckReport(input({ status: "missing", modifiedAt: null })),
    ).toContain('"Sync all other types"');
  });

  it("flags feeds with different IDs on the two devices", () => {
    expect(
      formatSyncCheckReport(
        input({ entriesForUnknownFeeds: 120, unreadWithNoEntryOnDisk: 300 }),
      ),
    ).toContain("different IDs");
  });

  it("flags unread articles the other device never recorded", () => {
    expect(
      formatSyncCheckReport(input({ unreadWithNoEntryOnDisk: 300 })),
    ).toContain("300 unread articles aren't in the file at all");
  });
});
