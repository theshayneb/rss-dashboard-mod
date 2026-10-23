/**
 * Importing from the upstream RSS Dashboard plugin into this fork: reading
 * its portable bundle while it is loaded, and loading beside it.
 */
import { describe, expect, it, vi } from "vitest";
import type { App } from "obsidian";
import {
  ORIGINAL_PLUGIN_ID,
  readOriginalPluginSnapshot,
} from "../../../src/utils/original-plugin-import";
import { RSS_DASHBOARD_VIEW_TYPE } from "../../../src/views/dashboard-view";
import { RSS_DISCOVER_VIEW_TYPE } from "../../../src/views/discover-view";
import { RSS_READER_VIEW_TYPE } from "../../../src/views/reader-view";
import { RSS_SMALLWEB_VIEW_TYPE } from "../../../src/views/kagi-smallweb-view";

function appWith(plugin: unknown): App {
  return {
    vault: { configDir: "config" },
    plugins: {
      getPlugin: (id: string) => (id === ORIGINAL_PLUGIN_ID ? plugin : null),
    },
  } as unknown as App;
}

describe("readOriginalPluginSnapshot()", () => {
  it("returns the original plugin's bundle when it is enabled", () => {
    const portable = { version: 1 };
    const snapshot = readOriginalPluginSnapshot(
      appWith({ getPortableDataBundle: vi.fn(() => portable) }),
    );

    expect(snapshot).toEqual({ bundle: portable });
  });

  it("returns null when the original plugin is not enabled", () => {
    expect(readOriginalPluginSnapshot(appWith(null))).toBeNull();
  });

  it("returns null when the original plugin cannot export a bundle", () => {
    expect(readOriginalPluginSnapshot(appWith({ manifest: {} }))).toBeNull();
  });
});

describe("running alongside the original plugin", () => {
  it("registers view types the original plugin does not, so both can load", () => {
    // Obsidian throws when a second plugin registers an existing view type,
    // which would stop this plugin loading while the original is enabled.
    const originalViewTypes = [
      "rss-dashboard-view",
      "rss-discover-view",
      "rss-reader-view",
      "rss-smallweb-view",
    ];

    for (const viewType of [
      RSS_DASHBOARD_VIEW_TYPE,
      RSS_DISCOVER_VIEW_TYPE,
      RSS_READER_VIEW_TYPE,
      RSS_SMALLWEB_VIEW_TYPE,
    ]) {
      expect(originalViewTypes).not.toContain(viewType);
    }
  });
});
