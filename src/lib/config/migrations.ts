/**
 * Company Configuration versioning & migration (Phase 4, §5.3, §5.4).
 *
 * `version` lives at the document root. A shape-breaking change to any section
 * bumps `CURRENT_CONFIG_VERSION` and adds a pure migration function keyed by the
 * version it upgrades *from*. Purely additive changes (a new optional key or a
 * whole new section) need no bump — the read-path's defaults merge handles them.
 *
 * Strategy is upgrade-on-read: `getCompanyConfig()` runs a tenant's stored JSON
 * through `migrateToLatest()` before validating; the next `updateCompanyConfig()`
 * persists the now-current shape back (write-back-on-read). No deploy-time batch
 * job ever touches every row.
 *
 * Maintenance trigger (§5.4): once three or more migration functions accumulate,
 * collapse them into a single composite and retire the intermediates.
 */

/** The schema version this build writes and validates against. */
export const CURRENT_CONFIG_VERSION = 1;

/** A pure transform from one stored shape to the next version's shape. */
export type ConfigMigration = (
  raw: Record<string, unknown>,
) => Record<string, unknown>;

/**
 * Ordered migrations keyed by the version they upgrade *from*. v1 is the first
 * version, so the chain is empty until a shape-breaking change lands (e.g.
 * `1: migrateV1toV2`).
 */
const migrations: Record<number, ConfigMigration> = {};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Run a stored config from its persisted `version` up to
 * `CURRENT_CONFIG_VERSION`. Unknown/legacy blobs (including `{}`) are treated as
 * already-current and left for the defaults merge to fill in. The returned
 * object always carries `version: CURRENT_CONFIG_VERSION`.
 */
export function migrateToLatest(raw: unknown): Record<string, unknown> {
  let current: Record<string, unknown> = isRecord(raw) ? { ...raw } : {};

  let version =
    typeof current.version === "number"
      ? current.version
      : CURRENT_CONFIG_VERSION;

  while (version < CURRENT_CONFIG_VERSION) {
    const migrate = migrations[version];
    if (!migrate) break;
    current = migrate(current);
    version += 1;
  }

  current.version = CURRENT_CONFIG_VERSION;
  return current;
}
