import type { App } from "obsidian";

/** Manifest id of the upstream RSS Dashboard plugin this fork derives from. */
export const ORIGINAL_PLUGIN_ID = "rss-dashboard";

/** Shown in the import confirmation in place of a file name. */
export const ORIGINAL_PLUGIN_SOURCE_NAME = "the original RSS Dashboard plugin";

interface OriginalPluginInstance {
  getPortableDataBundle?: () => unknown;
}

type AppWithPlugins = App & {
  plugins?: {
    getPlugin?: (id: string) => unknown;
    plugins?: Record<string, unknown>;
  };
};

export interface OriginalPluginSnapshot {
  bundle: unknown;
}

/**
 * Reads a portable data bundle from the original plugin while it is loaded.
 * Returns null when it is not installed and enabled, or predates bundles.
 */
export function readOriginalPluginSnapshot(
  app: App,
): OriginalPluginSnapshot | null {
  const plugins = (app as AppWithPlugins).plugins;
  const original = (plugins?.getPlugin?.(ORIGINAL_PLUGIN_ID) ??
    plugins?.plugins?.[ORIGINAL_PLUGIN_ID]) as
    | OriginalPluginInstance
    | null
    | undefined;

  if (typeof original?.getPortableDataBundle !== "function") {
    return null;
  }

  return { bundle: original.getPortableDataBundle() };
}
