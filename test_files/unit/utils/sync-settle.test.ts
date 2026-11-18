/**
 * Automatic writes wait until Obsidian Sync has likely caught up, so a device
 * that was away does not write over changes still arriving.
 */
import { describe, expect, it } from "vitest";
import { App } from "obsidian";
import {
  RESUME_AFTER_HIDDEN_MS,
  SETTLE_AFTER_START_MS,
  SETTLE_QUIET_MS,
  SyncSettleTracker,
} from "../../../src/utils/sync-settle";

function tracker(app: App = App.createMock()) {
  let now = 1_000_000;
  const settle = new SyncSettleTracker(app, () => now);
  return { settle, advance: (ms: number) => (now += ms) };
}

function withSync(syncing: boolean): App {
  const app = App.createMock();
  (app as unknown as { internalPlugins: unknown }).internalPlugins = {
    getPluginById: (id: string) =>
      id === "sync" ? { enabled: true, instance: { syncing } } : null,
  };
  return app;
}

describe("SyncSettleTracker", () => {
  it("waits a few minutes after Obsidian starts", () => {
    const { settle, advance } = tracker();
    expect(settle.isSettled()).toBe(false);
    advance(SETTLE_AFTER_START_MS);
    expect(settle.isSettled()).toBe(true);
  });

  it("waits until no vault file has changed for a minute", () => {
    const { settle, advance } = tracker();
    advance(SETTLE_AFTER_START_MS);
    settle.noteVaultChange();
    expect(settle.isSettled()).toBe(false);
    advance(SETTLE_QUIET_MS);
    expect(settle.isSettled()).toBe(true);
  });

  it("waits while Obsidian Sync says it is syncing", () => {
    const busy = tracker(withSync(true));
    busy.advance(SETTLE_AFTER_START_MS);
    expect(busy.settle.isSettled()).toBe(false);

    const idle = tracker(withSync(false));
    idle.advance(SETTLE_AFTER_START_MS);
    expect(idle.settle.isSettled()).toBe(true);
  });

  it("starts the wait again when the app comes back after a long time away", () => {
    const { settle, advance } = tracker();
    advance(SETTLE_AFTER_START_MS);
    settle.noteVisibility(false);
    advance(RESUME_AFTER_HIDDEN_MS);
    settle.noteVisibility(true);
    expect(settle.isSettled()).toBe(false);
    advance(SETTLE_AFTER_START_MS);
    expect(settle.isSettled()).toBe(true);
  });

  it("does not restart the wait after a short switch away", () => {
    const { settle, advance } = tracker();
    advance(SETTLE_AFTER_START_MS);
    settle.noteVisibility(false);
    advance(10_000);
    settle.noteVisibility(true);
    expect(settle.isSettled()).toBe(true);
  });
});
