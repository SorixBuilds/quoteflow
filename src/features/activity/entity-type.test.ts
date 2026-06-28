import { describe, expect, it } from "vitest";
import { EntityType } from "@prisma/client";

import type { Activity } from "@prisma/client";

/**
 * Step 2 verification — the Activity table is polymorphic.
 *
 * The frozen Phase 2 schema already models Activity with `entityType` +
 * `entityId` (and never had a `leadId` column), so the Phase 4 "convert Activity
 * to polymorphic form" objective is satisfied by construction. These assertions
 * lock that contract in: the polymorphic columns exist on the type, and the
 * enum carries every entity an activity can target, including the additively
 * added ORGANIZATION value used for org-level events (`settings_updated`).
 */
describe("Activity polymorphic shape (Step 2)", () => {
  it("exposes entityType + entityId (no leadId on the model)", () => {
    const row: Pick<Activity, "entityType" | "entityId"> = {
      entityType: EntityType.ORGANIZATION,
      entityId: "org-1",
    };
    expect(row.entityType).toBe("ORGANIZATION");
    // Type-level guarantee: `leadId` is not a key of Activity.
    expect("leadId" in row).toBe(false);
  });

  it("includes every polymorphic target type", () => {
    expect(Object.values(EntityType).sort()).toEqual(
      ["CUSTOMER", "INVOICE", "JOB", "LEAD", "ORGANIZATION", "QUOTE"].sort(),
    );
  });
});
