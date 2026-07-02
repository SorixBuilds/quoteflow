import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { repo, entityFields, dbMock, email, activity } = vi.hoisted(() => ({
  repo: {
    getRulesForTrigger: vi.fn(),
    createAutomationLog: vi.fn(),
    getLastLogForRuleEntity: vi.fn(),
  },
  entityFields: { loadEntitySnapshot: vi.fn(), resolveSystemActorId: vi.fn() },
  dbMock: {
    user: { findMany: vi.fn() },
    notification: { createMany: vi.fn() },
    task: { create: vi.fn() },
  },
  email: { rebuildEmailJob: vi.fn(), sendTemplatedEmail: vi.fn() },
  activity: { logActivity: vi.fn() },
}));

vi.mock("@/features/automation/repository", () => repo);
vi.mock("@/features/automation/entity-fields", () => entityFields);
vi.mock("@/lib/db", () => ({ db: dbMock }));
vi.mock("@/features/email/dispatch", () => ({ rebuildEmailJob: email.rebuildEmailJob }));
vi.mock("@/features/email/send", () => ({ sendTemplatedEmail: email.sendTemplatedEmail }));
vi.mock("@/features/activity/actions", () => ({ logActivity: activity.logActivity }));
vi.mock("@/lib/logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));

import { fireTrigger } from "@/features/automation/engine";
import { logger } from "@/lib/logger";

/**
 * Engine invariants (§15.7, §15.10, §15.12). Every firing writes exactly one
 * AutomationLog row per rule; a SKIPPED rule runs zero actions; a failing action
 * is isolated from its siblings and from the caller; nothing ever throws out of
 * `fireTrigger`.
 */
function rule(overrides: Record<string, unknown>) {
  return {
    id: "r1",
    conditions: [],
    actions: [{ type: "send_notification", title: "Hi" }],
    ...overrides,
  };
}

beforeEach(() => {
  repo.createAutomationLog.mockResolvedValue({});
  entityFields.loadEntitySnapshot.mockResolvedValue({ status: "ACCEPTED", total: 5000 });
  entityFields.resolveSystemActorId.mockResolvedValue("owner-1");
  dbMock.user.findMany.mockResolvedValue([{ id: "u1" }]);
  dbMock.notification.createMany.mockResolvedValue({ count: 1 });
  dbMock.task.create.mockResolvedValue({ id: "t1" });
  activity.logActivity.mockResolvedValue(undefined);
});
afterEach(() => vi.clearAllMocks());

describe("fireTrigger — matched rule", () => {
  it("runs the action and logs SUCCESS", async () => {
    repo.getRulesForTrigger.mockResolvedValue([
      rule({ conditions: [{ field: "total", op: "gte", value: "1000" }] }),
    ]);

    await fireTrigger("quote.accepted", "q1", "org-1");

    expect(dbMock.notification.createMany).toHaveBeenCalledOnce();
    expect(repo.createAutomationLog).toHaveBeenCalledWith(
      expect.objectContaining({ ruleId: "r1", entityType: "QUOTE", entityId: "q1", status: "SUCCESS" }),
    );
  });
});

describe("fireTrigger — conditions not met (§15.12)", () => {
  it("logs SKIPPED and performs zero actions, every time", async () => {
    repo.getRulesForTrigger.mockResolvedValue([
      rule({ conditions: [{ field: "total", op: "gte", value: "999999" }] }),
    ]);

    await fireTrigger("quote.accepted", "q1", "org-1");
    await fireTrigger("quote.accepted", "q1", "org-1");

    expect(dbMock.notification.createMany).not.toHaveBeenCalled();
    expect(repo.createAutomationLog).toHaveBeenCalledTimes(2);
    expect(repo.createAutomationLog).toHaveBeenLastCalledWith(
      expect.objectContaining({ status: "SKIPPED" }),
    );
  });
});

describe("fireTrigger — per-action isolation (§15.10)", () => {
  it("a failing action does not block the next one, and the rule is logged FAILED", async () => {
    dbMock.notification.createMany.mockRejectedValueOnce(new Error("boom"));
    repo.getRulesForTrigger.mockResolvedValue([
      rule({
        actions: [
          { type: "send_notification", title: "x" },
          { type: "log_activity", message: "still runs" },
        ],
      }),
    ]);

    await fireTrigger("quote.accepted", "q1", "org-1");

    // Second action ran despite the first throwing.
    expect(activity.logActivity).toHaveBeenCalledOnce();
    const logCall = repo.createAutomationLog.mock.calls[0][0];
    expect(logCall.status).toBe("FAILED");
    expect(logCall.resultMessage).toContain("send_notification");
  });
});

describe("fireTrigger — never throws", () => {
  it("swallows an infrastructure failure and logs it", async () => {
    repo.getRulesForTrigger.mockRejectedValue(new Error("db down"));
    await expect(fireTrigger("quote.accepted", "q1", "org-1")).resolves.toBeUndefined();
    expect(logger.error).toHaveBeenCalled();
  });

  it("no rules → no snapshot load, no work", async () => {
    repo.getRulesForTrigger.mockResolvedValue([]);
    await fireTrigger("quote.accepted", "q1", "org-1");
    expect(entityFields.loadEntitySnapshot).not.toHaveBeenCalled();
    expect(repo.createAutomationLog).not.toHaveBeenCalled();
  });
});
