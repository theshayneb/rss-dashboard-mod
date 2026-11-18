import type { App } from "obsidian";

/** How long Obsidian must have been open, or back in front, before automatic writes. */
export const SETTLE_AFTER_START_MS = 3 * 60 * 1000;
/** How long no vault file may have changed: Sync delivers other devices' work as file changes. */
export const SETTLE_QUIET_MS = 60 * 1000;
/** Being away at least this long counts as a resume, which restarts the settle wait. */
export const RESUME_AFTER_HIDDEN_MS = 5 * 60 * 1000;

type AppWithInternalPlugins = App & {
  internalPlugins?: {
    getPluginById?: (
      id: string,
    ) => { enabled?: boolean; instance?: { syncing?: unknown } } | null;
  };
};

/**
 * Tells whether Obsidian Sync has likely caught up, so automatic work does
 * not write over changes still on their way from other devices. Adapted
 * from plex-to-obsidian's `syncSettled()`: Obsidian has been open (or back
 * from the background) a few minutes, no vault file has changed for a
 * minute, and Sync, where it says so, is not syncing. The Sync check reads
 * Obsidian internals, so it is guarded and only ever delays work.
 */
export class SyncSettleTracker {
  private startedAt: number;
  private lastVaultChange = 0;
  private hiddenAt: number | null = null;

  constructor(
    private readonly app: App,
    private readonly now: () => number = () => Date.now(),
  ) {
    this.startedAt = now();
  }

  noteVaultChange(): void {
    this.lastVaultChange = this.now();
  }

  /** Call when the app goes to the background or comes back. */
  noteVisibility(visible: boolean): void {
    if (!visible) {
      this.hiddenAt ??= this.now();
      return;
    }
    if (this.hiddenAt !== null && this.now() - this.hiddenAt >= RESUME_AFTER_HIDDEN_MS) {
      // Back after a while: Sync now has hours or days of catching up to do.
      this.startedAt = this.now();
    }
    this.hiddenAt = null;
  }

  isSettled(): boolean {
    const now = this.now();
    if (now - this.startedAt < SETTLE_AFTER_START_MS) return false;
    if (now - this.lastVaultChange < SETTLE_QUIET_MS) return false;
    try {
      const sync = (this.app as AppWithInternalPlugins).internalPlugins?.getPluginById?.(
        "sync",
      );
      return !(sync?.enabled && sync.instance?.syncing === true);
    } catch {
      return true;
    }
  }
}
