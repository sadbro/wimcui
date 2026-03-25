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

export const CANVAS_VERSION = 1;

// Each key migrates from that version → version + 1
// Example:
//   1: (state) => {
//     // transform v1 → v2
//     return { ...state, someNewField: "default", version: 2 };
//   },
const MIGRATIONS = {};

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
