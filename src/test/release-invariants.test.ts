import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Release invariants (Phase 6B Step 12 — Definition of Done, §28).
 *
 * Machine-checkable guardrails for the two structural DoD promises that are
 * easiest for a future change to break silently:
 *
 *   1. "No frozen Phase 1–5 table, column, enum, route, or component is
 *      altered, renamed, or removed" — enforced here as: NO migration in the
 *      history performs a destructive operation. Any future `DROP`/`ALTER
 *      COLUMN` lands this test red before it can erode the additive-only
 *      guarantee the whole of Phase 6 rests on.
 *   2. "Every schema addition matches §7.2 exactly" — the nine Phase 6 tables
 *      and the two additive columns are present in the Prisma schema.
 *
 * These run as pure file reads (no DB), so they belong to the standard unit
 * suite and gate every CI run.
 */

const ROOT = process.cwd();

describe("migrations are additive-only (§28: no frozen artifact altered)", () => {
  const migrationsDir = join(ROOT, "prisma", "migrations");

  /** Destructive DDL that would break the additive-only guarantee. */
  const DESTRUCTIVE = [
    /\bDROP\s+TABLE\b/i,
    /\bDROP\s+COLUMN\b/i,
    /\bDROP\s+CONSTRAINT\b/i,
    /\bDROP\s+NOT\s+NULL\b/i,
    /\bRENAME\s+COLUMN\b/i,
    /\bRENAME\s+TO\b/i,
    /\bALTER\s+COLUMN\b[\s\S]*?\bTYPE\b/i,
  ];

  function migrationSql(): { file: string; sql: string }[] {
    const results: { file: string; sql: string }[] = [];
    for (const entry of readdirSync(migrationsDir)) {
      const sqlPath = join(migrationsDir, entry, "migration.sql");
      try {
        results.push({ file: entry, sql: readFileSync(sqlPath, "utf8") });
      } catch {
        // Not a migration directory (e.g. migration_lock.toml) — skip.
      }
    }
    return results;
  }

  it("contains at least the known migration history", () => {
    expect(migrationSql().length).toBeGreaterThanOrEqual(5);
  });

  it("performs no destructive schema operation in any migration", () => {
    const offenders: string[] = [];
    for (const { file, sql } of migrationSql()) {
      for (const pattern of DESTRUCTIVE) {
        if (pattern.test(sql)) offenders.push(`${file}: ${pattern}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});

describe("Phase 6 schema additions are present (§28 / §7.2)", () => {
  const schema = readFileSync(join(ROOT, "prisma", "schema.prisma"), "utf8");

  it.each([
    "EmailLog",
    "FileAttachment",
    "ApiKey",
    "Webhook",
    "WebhookDelivery",
    "AutomationRule",
    "AutomationLog",
    "Integration",
    "PortalAccessToken",
    "AiUsageLog",
  ])("declares the %s table", (model) => {
    expect(schema).toMatch(new RegExp(`model\\s+${model}\\s*\\{`));
  });

  it("adds the two additive columns (Job.scheduledEndAt, User.notificationPreferences)", () => {
    expect(schema).toMatch(/scheduledEndAt\s+DateTime\?/);
    expect(schema).toMatch(/notificationPreferences\s+Json\?/);
  });
});
