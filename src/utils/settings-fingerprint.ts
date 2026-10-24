/**
 * Fields every save adds to data.json only so sync tools notice the write
 * (see `withSyncNonce`). Two copies that differ in nothing else hold the
 * same settings.
 */
const SYNC_BOOKKEEPING_KEYS = new Set(["_syncNonce", "_syncPad"]);

/** Compares saved settings while ignoring the per-save sync bookkeeping. */
export function settingsFingerprint(data: unknown): string {
  return JSON.stringify(data ?? null, (key, value: unknown) =>
    SYNC_BOOKKEEPING_KEYS.has(key) ? undefined : value,
  );
}
