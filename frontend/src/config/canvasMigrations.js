/**
 * Canvas JSON versioning and migration.
 *
 * CANVAS_VERSION is the current schema version (integer).
 * MIGRATIONS maps a version number to a function that transforms
 * that version's state into version + 1.
 *
 * To add a migration:
 *   1. Bump CANVAS_VERSION
 *   2. Add an entry: MIGRATIONS[oldVersion] = (state) => ({ ...transformed, version: newVersion })
 */

export const CANVAS_VERSION = 2;

// Each key migrates from that version → version + 1
const MIGRATIONS = {
  /**
   * v1 → v2: Node label cleanup.
   *
   * Labels were previously derived as `TYPE.name` (e.g. "EC2.web-server").
   * This format leaked internal naming into the canvas display.
   *
   * New behaviour: the node label is the human name only. The type is shown
   * separately in the node UI as a small chip above the label.
   *
   * Migration: for any node whose label matches the old `TYPE.name` pattern,
   * replace it with `config.display_name` (if set) or `config.name` or the
   * bare resource type as a fallback.
   *
   * `display_name` is not removed — it remains in config for any canvas that
   * had it explicitly set, and the label derivation in onEditSave still
   * respects it as the primary source.
   */
  1: (state) => {
    const nodes = (state.nodes || []).map((node) => {
      const resourceType = node.data?.resourceType || "";
      const label = node.data?.label || "";
      const cfg = node.data?.config || {};

      // Detect old TYPE.name format: label starts with "{resourceType}."
      const isOldFormat = label.startsWith(`${resourceType}.`);
      if (!isOldFormat) return node;

      const newLabel = cfg.display_name?.trim() || cfg.name?.trim() || resourceType;
      return {
        ...node,
        data: { ...node.data, label: newLabel },
      };
    });

    return { ...state, nodes, version: 2 };
  },
};

/**
 * Migrate a canvas JSON object to the latest version.
 * Handles legacy files (no version, string "1.0", etc.)
 *
 * @param {object} state - raw parsed canvas JSON
 * @returns {{ state: object, warnings: string[] }}
 */
export function migrateCanvas(raw) {
  const warnings = [];

  // Normalize version: legacy files have undefined, "1.0", or other string values
  let version = raw.version;
  if (version === undefined || version === null || version === "1.0") {
    version = 1;
  }
  if (typeof version === "string") {
    version = parseFloat(version) || 1;
  }

  let state = { ...raw, version };

  // Run migrations in sequence
  while (MIGRATIONS[state.version]) {
    state = MIGRATIONS[state.version](state);
  }

  if (state.version > CANVAS_VERSION) {
    warnings.push(
      `File is version ${raw.version} but this app supports up to v${CANVAS_VERSION}. Some features may not load correctly.`
    );
  } else if (state.version < CANVAS_VERSION) {
    warnings.push(
      `File version ${raw.version ?? "unknown"} migrated to v${state.version}, but latest is v${CANVAS_VERSION}. Some migrations may be missing.`
    );
  }

  return { state, warnings };
}
