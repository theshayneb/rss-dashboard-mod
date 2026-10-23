import { normalizePath, type App } from "obsidian";
import type { PortableDataBundle } from "../types/types";

/** Manifest id of the upstream RSS Dashboard plugin this fork derives from. */
export const ORIGINAL_PLUGIN_ID = "rss-dashboard";

/** Shown in the import confirmation in place of a file name. */
export const ORIGINAL_PLUGIN_SOURCE_NAME = "the original RSS Dashboard plugin";

interface OriginalPluginInstance {
  manifest?: { dir?: string };
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
  pluginDir: string;
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

  return {
    bundle: original.getPortableDataBundle(),
    pluginDir: normalizePath(
      original.manifest?.dir ??
        `${app.vault.configDir}/plugins/${ORIGINAL_PLUGIN_ID}`,
    ),
  };
}

function relocate(
  path: unknown,
  fromDir: string,
  toDir: string,
): string | undefined {
  if (typeof path !== "string") return undefined;
  const normalized = normalizePath(path);
  if (normalized === fromDir) return toDir;
  if (normalized.startsWith(`${fromDir}/`)) {
    return `${toDir}${normalized.slice(fromDir.length)}`;
  }
  return path;
}

/**
 * Moves storage paths that live inside the original plugin's folder into this
 * plugin's folder, so the imported data does not depend on the original
 * staying installed. Vault folders outside the plugin folder are left as is.
 */
export function relocatePluginFolderPaths(
  bundle: PortableDataBundle,
  fromDir: string,
  toDir: string,
): PortableDataBundle {
  const from = normalizePath(fromDir);
  const to = normalizePath(toDir);
  const metadata = { ...bundle.metadata };

  if (typeof metadata.storageFolder === "string") {
    metadata.storageFolder = relocate(metadata.storageFolder, from, to) ?? "";
  }
  if (typeof metadata.metadataStorageFolder === "string") {
    metadata.metadataStorageFolder =
      relocate(metadata.metadataStorageFolder, from, to) ?? "";
  }

  return {
    ...bundle,
    storageFolder: relocate(bundle.storageFolder, from, to),
    metadataStorageFolder: relocate(bundle.metadataStorageFolder, from, to),
    metadata,
  };
}
