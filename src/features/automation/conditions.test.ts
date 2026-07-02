import { describe, expect, it } from "vitest";

import { evaluateCondition, evaluateConditions } from "@/features/automation/conditions";
import type { ConditionOperator } from "@/features/automation/types";

/**
 * Operator coverage (§15.12) — every supported operator, plus the AND-combining
 * and the "unknown field never matches / never throws" guarantees the engine
 * relies on for safety.
 */
const snapshot = {
  status: "ACCEPTED",
  total: 5000,
  name: "Acme Widgets",
  email: null,
  scheduledDate: "2026-07-10T00:00:00.000Z",
};

function evalOne(field: string, op: ConditionOperator, value: string): boolean {
  return evaluateCondition({ field, op, value }, snapshot);
}

describe("evaluateCondition operators", () => {
  it("eq / neq compare as strings", () => {
    expect(evalOne("status", "eq", "ACCEPTED")).toBe(true);
    expect(evalOne("status", "eq", "DRAFT")).toBe(false);
    expect(evalOne("status", "neq", "DRAFT")).toBe(true);
  });

  it("numeric gt / gte / lt / lte coerce both sides", () => {
    expect(evalOne("total", "gte", "5000")).toBe(true);
    expect(evalOne("total", "gt", "5000")).toBe(false);
    expect(evalOne("total", "gt", "4999")).toBe(true);
    expect(evalOne("total", "lt", "5001")).toBe(true);
    expect(evalOne("total", "lte", "5000")).toBe(true);
  });

  it("date fields order correctly via ISO string comparison", () => {
    expect(evalOne("scheduledDate", "gt", "2026-07-01T00:00:00.000Z")).toBe(true);
    expect(evalOne("scheduledDate", "lt", "2026-07-01T00:00:00.000Z")).toBe(false);
  });

  it("contains is case-insensitive substring", () => {
    expect(evalOne("name", "contains", "widget")).toBe(true);
    expect(evalOne("name", "contains", "gadget")).toBe(false);
  });

  it("is_empty / is_not_empty treat null and blank as empty", () => {
    expect(evalOne("email", "is_empty", "")).toBe(true);
    expect(evalOne("name", "is_not_empty", "")).toBe(true);
    expect(evalOne("email", "is_not_empty", "")).toBe(false);
  });

  it("a field absent from the snapshot never matches and never throws", () => {
    expect(evalOne("secretColumn", "eq", "x")).toBe(false);
    expect(evalOne("secretColumn", "gt", "0")).toBe(false);
    expect(evalOne("secretColumn", "is_empty", "")).toBe(true);
  });
});

describe("evaluateConditions (AND)", () => {
  it("is true only when every clause holds", () => {
    expect(
      evaluateConditions(
        [
          { field: "status", op: "eq", value: "ACCEPTED" },
          { field: "total", op: "gte", value: "1000" },
        ],
        snapshot,
      ),
    ).toBe(true);

    expect(
      evaluateConditions(
        [
          { field: "status", op: "eq", value: "ACCEPTED" },
          { field: "total", op: "gte", value: "9999" },
        ],
        snapshot,
      ),
    ).toBe(false);
  });

  it("an empty condition set always matches", () => {
    expect(evaluateConditions([], snapshot)).toBe(true);
  });
});
