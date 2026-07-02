import type { AutomationCondition, ConditionOperator } from "@/features/automation/types";

/**
 * Condition evaluation (Phase 6B Step 6, §15.6, §15.12).
 *
 * Pure, deterministic, dependency-free — every supported operator lives here and
 * is unit-tested in isolation. The engine loads a server-authoritative snapshot
 * of the triggering entity (a flat record of whitelisted fields) and asks this
 * function "do all conditions hold?". Conditions are AND-combined; an empty set
 * means "always run". A condition naming a field absent from the snapshot
 * compares against `undefined` and fails to match — never throws, never leaks an
 * un-whitelisted column.
 */

/** The evaluable snapshot: whitelisted primitives only (numbers, strings, dates). */
export type EntitySnapshot = Record<string, string | number | boolean | null | undefined>;

function toNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

function isEmpty(value: unknown): boolean {
  return value === null || value === undefined || String(value).trim() === "";
}

/** Evaluate one clause against the snapshot. */
export function evaluateCondition(
  condition: AutomationCondition,
  snapshot: EntitySnapshot,
): boolean {
  const left = snapshot[condition.field];
  const { op, value } = condition;

  switch (op) {
    case "is_empty":
      return isEmpty(left);
    case "is_not_empty":
      return !isEmpty(left);
    case "eq":
      return String(left ?? "") === String(value);
    case "neq":
      return String(left ?? "") !== String(value);
    case "contains":
      return String(left ?? "").toLowerCase().includes(String(value).toLowerCase());
    case "gt":
    case "gte":
    case "lt":
    case "lte": {
      const cmp = compareOrderable(left, value);
      if (cmp === null) return false; // non-comparable operands never match
      return applyOrder(op, cmp);
    }
    default:
      // Exhaustiveness guard — an unknown operator (impossible past validation)
      // never silently "matches".
      return assertNever(op);
  }
}

/**
 * Compare two operands for ordering. Numbers compare numerically; otherwise the
 * values compare lexicographically (ISO date strings sort chronologically, so
 * date fields order correctly). Returns -1/0/1, or null when not comparable.
 */
function compareOrderable(left: unknown, right: string): number | null {
  const ln = toNumber(left);
  const rn = toNumber(right);
  if (ln !== null && rn !== null) {
    return ln === rn ? 0 : ln < rn ? -1 : 1;
  }
  if (left === null || left === undefined) return null;
  const ls = String(left);
  return ls === right ? 0 : ls < right ? -1 : 1;
}

function applyOrder(op: "gt" | "gte" | "lt" | "lte", cmp: number): boolean {
  switch (op) {
    case "gt":
      return cmp > 0;
    case "gte":
      return cmp >= 0;
    case "lt":
      return cmp < 0;
    case "lte":
      return cmp <= 0;
  }
}

/** All conditions must hold (AND). Empty set → always true. */
export function evaluateConditions(
  conditions: AutomationCondition[],
  snapshot: EntitySnapshot,
): boolean {
  return conditions.every((c) => evaluateCondition(c, snapshot));
}

function assertNever(op: ConditionOperator): never {
  throw new Error(`Unsupported operator: ${op}`);
}
