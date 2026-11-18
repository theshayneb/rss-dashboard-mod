/**
 * Shared settings, merged by edit time across devices.
 *
 * Obsidian Sync resolves a plugin's data.json by laying the receiving
 * device's keys over the remote copy, so the device that saves last wins
 * whole keys such as the feed list, and other vault files simply keep the
 * newest copy. A phone or tablet that syncs hours or days late would undo
 * edits made meanwhile elsewhere.
 *
 * So each device writes only its own `settings.<deviceId>.json`, holding
 * every shared setting as an entry with the time it was last edited, and
 * deletions as tombstones. Reading merges every device's file, keeping each
 * entry's newest edit. data.json, written by older versions, is read as
 * input dated 0: it can add what no device file has, never override an
 * edit.
 */
import type {
  Feed,
  Folder,
  HighlightWord,
  KeywordFilterRule,
  RssDashboardSettings,
  SavedTemplate,
  Tag,
} from "../types/types";
import { DEVICE_SETTING_KEYS, FEED_DEVICE_KEYS } from "../utils/device-state";

export const SHARED_SETTINGS_SCHEMA_VERSION = 1;

/** One shared setting: its value and when it was edited, or when it was deleted. */
export interface SharedEntry {
  v?: unknown;
  /** Edit time (or deletion time) in ms; 0 for values from before edit times. */
  t: number;
  /** Set when the entry was deleted. */
  d?: number;
}

export interface SharedSettingsFile {
  schemaVersion: number;
  entries: Record<string, SharedEntry>;
}

export interface SharedSettingsSource {
  entries: Record<string, SharedEntry>;
  isOwn: boolean;
}

/**
 * Where the data folder is: kept in data.json, because the settings files
 * live inside that folder.
 */
export const BOOTSTRAP_KEYS = [
  "storageMode",
  "storageFolder",
  "storageSchemaVersion",
  "metadataStorageMode",
  "metadataStorageFolder",
  "metadataStorageSchemaVersion",
] as const;

const SKIPPED_KEYS = new Set<string>([
  ...BOOTSTRAP_KEYS,
  ...DEVICE_SETTING_KEYS,
  "feeds",
  "folders",
  "availableTags",
  "_syncNonce",
  "_syncPad",
]);

/** Collections inside a settings group, each item an entry of its own. */
const NESTED_COLLECTIONS: Record<string, { field: string; prefix: string }> = {
  articleSaving: { field: "savedTemplates", prefix: "template" },
  highlights: { field: "words", prefix: "highlight" },
  keywordRules: { field: "rules", prefix: "keywordRule" },
};

const ORDER = "__order";

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** JSON with object keys sorted, so equal values compare equal. */
export function stableStringify(value: unknown): string {
  return JSON.stringify(value, (_key, inner: unknown) => {
    if (!isPlainObject(inner)) return inner;
    return Object.fromEntries(
      Object.keys(inner)
        .sort()
        .map((key) => [key, inner[key]]),
    );
  });
}

function clone<T>(value: T): T {
  return value === undefined ? value : (JSON.parse(JSON.stringify(value)) as T);
}

/**
 * A feed's entry key: its id, or, for a feed from data so old it has no id
 * yet, its address. Once it gets an id, the address entry becomes a
 * tombstone, so the feed is never listed twice.
 */
function feedEntryKey(feed: Pick<Feed, "feedId" | "url">): string {
  return feed.feedId ? `feed:${feed.feedId}` : `feed:url:${feed.url}`;
}

function flattenFolders(
  folders: Folder[],
  parentPath: string,
  out: Record<string, unknown>,
): void {
  folders.forEach((folder, index) => {
    const path = parentPath ? `${parentPath}/${folder.name}` : folder.name;
    const { subfolders, ...rest } = folder;
    out[`folder:${path}`] = { ...clone(rest), [ORDER]: index };
    flattenFolders(subfolders ?? [], path, out);
  });
}

/** Breaks the shared settings into entries keyed by what they are. */
export function flattenSharedSettings(
  settings: Partial<RssDashboardSettings>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};

  (settings.feeds ?? []).forEach((feed, index) => {
    const config: Record<string, unknown> = { ...clone(feed) };
    delete config.items;
    for (const key of FEED_DEVICE_KEYS) delete config[key];
    out[feedEntryKey(feed)] = { ...config, [ORDER]: index };
  });
  flattenFolders(settings.folders ?? [], "", out);
  (settings.availableTags ?? []).forEach((tag, index) => {
    out[`tag:${tag.name}`] = { ...clone(tag), [ORDER]: index };
  });

  for (const [key, value] of Object.entries(settings)) {
    if (SKIPPED_KEYS.has(key) || value === undefined) continue;
    const collection = NESTED_COLLECTIONS[key];
    if (isPlainObject(value)) {
      for (const [field, inner] of Object.entries(value)) {
        if (inner === undefined) continue;
        if (collection && field === collection.field && Array.isArray(inner)) {
          (inner as { id: string }[]).forEach((item, index) => {
            out[`${collection.prefix}:${item.id}`] = { ...clone(item), [ORDER]: index };
          });
          continue;
        }
        out[`setting:${key}.${field}`] = clone(inner);
      }
      continue;
    }
    out[`setting:${key}`] = clone(value);
  }
  return out;
}

/** The values of entries that are not deleted. */
export function liveSharedValues(
  entries: Record<string, SharedEntry>,
): Record<string, unknown> {
  const values: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(entries)) {
    if (entry.d === undefined) values[key] = entry.v;
  }
  return values;
}

function ordered<T>(items: [string, unknown][]): (T & Record<string, unknown>)[] {
  return items
    .map(([, value]) => value as T & Record<string, unknown>)
    .sort(
      (a, b) => Number(a[ORDER] ?? 0) - Number(b[ORDER] ?? 0),
    );
}

function withoutOrder<T>(value: T & Record<string, unknown>): T {
  const copy = { ...value };
  delete copy[ORDER];
  return copy as T;
}

function buildFolderTree(values: Record<string, unknown>): Folder[] {
  const byPath = new Map<string, Folder & { [ORDER]?: number }>();
  const paths = Object.keys(values)
    .filter((key) => key.startsWith("folder:"))
    .map((key) => key.slice("folder:".length))
    .sort((a, b) => a.split("/").length - b.split("/").length);
  const roots: (Folder & { [ORDER]?: number })[] = [];
  for (const path of paths) {
    const value = values[`folder:${path}`] as Folder & { [ORDER]?: number };
    const folder = { ...clone(value), subfolders: [] as Folder[] };
    byPath.set(path, folder);
    const parentPath = path.includes("/") ? path.slice(0, path.lastIndexOf("/")) : "";
    const parent = parentPath ? byPath.get(parentPath) : undefined;
    // A folder whose parent was deleted on another device stays, at the top.
    (parent ? parent.subfolders : roots).push(folder);
  }
  const finish = (folders: (Folder & { [ORDER]?: number })[]): Folder[] =>
    folders
      .sort((a, b) => Number(a[ORDER] ?? 0) - Number(b[ORDER] ?? 0))
      .map((folder) => {
        const { [ORDER]: _order, ...rest } = folder;
        void _order;
        return { ...rest, subfolders: finish(rest.subfolders) };
      });
  return finish(roots);
}

/**
 * Writes merged shared entries onto the settings in memory, keeping each
 * feed's articles and refresh bookkeeping, this device's layout, and where
 * the data folder is. Returns whether the feed list itself changed.
 */
export function applySharedEntries(
  settings: RssDashboardSettings,
  entries: Record<string, SharedEntry>,
): { feedsChanged: boolean } {
  const values = liveSharedValues(entries);
  const keys = Object.entries(values);

  // Feeds: update in place, keeping articles; add new ones; drop deleted.
  const feedValues = ordered<Feed>(keys.filter(([key]) => key.startsWith("feed:")));
  const before = settings.feeds.map((feed) => feed.feedId).join("\n");
  const existing = new Map(settings.feeds.map((feed) => [feedEntryKey(feed), feed]));
  settings.feeds = feedValues.map((value) => {
    const config = withoutOrder(value);
    const feed = existing.get(feedEntryKey(config));
    if (!feed) return { ...clone(config), items: [], lastUpdated: 0 } as Feed;
    for (const key of Object.keys(feed) as (keyof Feed)[]) {
      if (key === "items" || (FEED_DEVICE_KEYS as readonly string[]).includes(key)) continue;
      if (!(key in config)) delete feed[key];
    }
    Object.assign(feed, clone(config));
    return feed;
  });
  const feedsChanged = before !== settings.feeds.map((feed) => feed.feedId).join("\n");

  settings.folders = buildFolderTree(values);
  settings.availableTags = ordered<Tag>(keys.filter(([key]) => key.startsWith("tag:"))).map(
    (tag) => withoutOrder(tag),
  );

  for (const [groupKey, { field, prefix }] of Object.entries(NESTED_COLLECTIONS)) {
    const group = (settings as unknown as Record<string, Record<string, unknown>>)[groupKey];
    if (!isPlainObject(group)) continue;
    group[field] = ordered<SavedTemplate | HighlightWord | KeywordFilterRule>(
      keys.filter(([key]) => key.startsWith(`${prefix}:`)),
    ).map((item) => withoutOrder(item));
  }

  const target = settings as unknown as Record<string, unknown>;
  for (const [key, entry] of Object.entries(entries)) {
    if (!key.startsWith("setting:")) continue;
    const path = key.slice("setting:".length);
    const dot = path.indexOf(".");
    if (dot < 0) {
      if (entry.d === undefined) target[path] = clone(entry.v);
      else delete target[path];
      continue;
    }
    const groupKey = path.slice(0, dot);
    const field = path.slice(dot + 1);
    const group = isPlainObject(target[groupKey]) ? target[groupKey] : {};
    if (entry.d === undefined) group[field] = clone(entry.v);
    else delete group[field];
    target[groupKey] = group;
  }

  return { feedsChanged };
}

/** Values from before edit times (data.json from older versions), dated 0. */
export function legacyEntries(
  settings: Partial<RssDashboardSettings> | null | undefined,
): Record<string, SharedEntry> {
  const entries: Record<string, SharedEntry> = {};
  if (!settings) return entries;
  for (const [key, value] of Object.entries(flattenSharedSettings(settings))) {
    entries[key] = { v: value, t: 0 };
  }
  return entries;
}

/**
 * Merges every source, keeping each entry's newest edit or deletion. On a
 * tie, a device file beats data.json and this device's file beats others.
 */
export function mergeSharedSources(
  sources: SharedSettingsSource[],
  legacy: Record<string, SharedEntry> = {},
): Record<string, SharedEntry> {
  const merged: Record<string, SharedEntry> = { ...legacy };
  const ordered = [...sources].sort((a, b) => Number(a.isOwn) - Number(b.isOwn));
  for (const { entries } of ordered) {
    for (const [key, entry] of Object.entries(entries)) {
      const current = merged[key];
      if (!current || entry.t >= current.t) merged[key] = entry;
    }
  }
  return merged;
}

/**
 * The entries this device changed since it last read or wrote the shared
 * settings (`known`): new or edited values dated `now`, and deletions as
 * tombstones dated `now`. Unchanged entries are left out.
 */
export function localSharedChanges(
  known: Record<string, SharedEntry>,
  current: Record<string, unknown>,
  now: number,
): Record<string, SharedEntry> {
  const changes: Record<string, SharedEntry> = {};
  for (const [key, value] of Object.entries(current)) {
    const was = known[key];
    if (
      !was ||
      was.d !== undefined ||
      stableStringify(was.v) !== stableStringify(value)
    ) {
      changes[key] = { v: clone(value), t: now };
    }
  }
  for (const [key, was] of Object.entries(known)) {
    if (!(key in current) && was.d === undefined) {
      changes[key] = { t: now, d: now };
    }
  }
  return changes;
}
