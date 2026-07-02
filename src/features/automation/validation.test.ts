import { describe, expect, it } from "vitest";

import { createAutomationRuleSchema } from "@/features/automation/validation";

/**
 * Closed-schema validation (§15.9). The point of this schema is that a rule can
 * only ever describe things the engine implements — an unknown trigger, an
 * unknown operator, or an unknown action type is rejected at the boundary, so a
 * configurable rule is never a code-injection surface.
 */
const base = {
  name: "Alert on high-value quotes",
  triggerType: "quote.accepted",
  conditions: [{ field: "total", op: "gte", value: "5000" }],
  actions: [{ type: "send_notification", title: "Big one!" }],
};

describe("createAutomationRuleSchema", () => {
  it("accepts a valid rule and defaults conditions/priority/role/isActive", () => {
    const rule = createAutomationRuleSchema.parse(base);
    expect(rule.isActive).toBe(true);
    expect(rule.conditions[0]).toEqual({ field: "total", op: "gte", value: "5000" });
    expect(rule.actions[0]).toMatchObject({ type: "send_notification", priority: "NORMAL", role: "OWNER" });
  });

  it("runs with no conditions (empty array = always)", () => {
    const rule = createAutomationRuleSchema.parse({ ...base, conditions: [] });
    expect(rule.conditions).toEqual([]);
  });

  it("rejects an unknown trigger type", () => {
    expect(() => createAutomationRuleSchema.parse({ ...base, triggerType: "quote.exploded" })).toThrow();
  });

  it("rejects an unknown condition operator", () => {
    expect(() =>
      createAutomationRuleSchema.parse({
        ...base,
        conditions: [{ field: "total", op: "matches_regex", value: ".*" }],
      }),
    ).toThrow();
  });

  it("rejects an unknown action type", () => {
    expect(() =>
      createAutomationRuleSchema.parse({ ...base, actions: [{ type: "run_shell", cmd: "rm -rf" }] }),
    ).toThrow();
  });

  it("requires at least one action", () => {
    expect(() => createAutomationRuleSchema.parse({ ...base, actions: [] })).toThrow();
  });

  it("rejects a send_email action with a template outside the allow-list", () => {
    expect(() =>
      createAutomationRuleSchema.parse({
        ...base,
        actions: [{ type: "send_email", template: "wire_transfer_details" }],
      }),
    ).toThrow();
  });

  it("requires a rule name", () => {
    expect(() => createAutomationRuleSchema.parse({ ...base, name: "" })).toThrow();
  });
});
