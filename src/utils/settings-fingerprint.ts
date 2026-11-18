/**
 * Fields versions before 2.8.0 added to every save only so sync tools
 * noticed the write. Older versions on other devices may still write them,
 * so two copies that differ in nothing else hold the same settings.
 */
const SYNC_BOOKKEEPING_KEYS = new Set(["_syncNonce", "_syncPad"]);

/** Compares saved settings while ignoring old versions' sync bookkeeping. */
export function settingsFingerprint(data: unknown): string {
  return JSON.stringify(data ?? null, (key, value: unknown) =>
    SYNC_BOOKKEEPING_KEYS.has(key) ? undefined : value,
  );
}
