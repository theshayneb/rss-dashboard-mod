import manifest from "../../manifest.json";

/**
 * The plugin's manifest id. Read from manifest.json so forks that rename the
 * plugin only change it in one place.
 */
export const PLUGIN_ID: string = manifest.id;
