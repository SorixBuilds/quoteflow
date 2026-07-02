import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { dbMock, activity, events } = vi.hoisted(() => ({
  dbMock: { customer: { create: vi.fn(), updateMany: vi.fn() } },
  activity: { logActivity: vi.fn() },
  events: { emitEvent: vi.fn() },
}));

vi.mock("@/lib/db", () => ({ db: dbMock }));
vi.mock("@/features/activity/actions", () => activity);
vi.mock("@/lib/events", () => events);

import { createCustomerCore, updateCustomerCore } from "@/features/customers/service";

/**
 * The behavioral half of the §21.12 equivalence guarantee: the shared core
 * produces the identical row, Activity record, and domain event for ANY caller
 * — the only per-plane variable is the ActorScope it is handed. A staff
 * session and an API key calling this function are indistinguishable below
 * this line.
 */

const scope = { organizationId: "org-1", actorId: "user-1" };

beforeEach(() => {
  dbMock.customer.create.mockResolvedValue({ id: "c1" });
  dbMock.customer.updateMany.mockResolvedValue({ count: 1 });
});
afterEach(() => vi.clearAllMocks());

describe("createCustomerCore (§21.6)", () => {
  it("creates the row, logs Activity to the actor, and emits customer.created", async () => {
    const result = await createCustomerCore(scope, {
      name: "Acme LLC",
      type: "BUSINESS",
      email: "ops@acme.test",
      phone: "",
      address: { street: "1 Main St", city: "", state: "", postal: "", country: "" },
    });

    expect(result).toEqual({ id: "c1" });
    expect(dbMock.customer.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          organizationId: "org-1",
          name: "Acme LLC",
          email: "ops@acme.test",
          phone: null, // empty string normalized, same as the staff path always did
          address: { street: "1 Main St" }, // blank address fields dropped
        }),
      }),
    );
    expect(activity.logActivity).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: "org-1",
        entityType: "CUSTOMER",
        entityId: "c1",
        type: "created",
        createdById: "user-1",
      }),
    );
    expect(events.emitEvent).toHaveBeenCalledWith("customer.created", {
      organizationId: "org-1",
      customerId: "c1",
    });
  });
});

describe("updateCustomerCore", () => {
  it("scopes the update to the organization and emits customer.updated", async () => {
    const updated = await updateCustomerCore(scope, "c9", {
      name: "Acme LLC",
      type: "BUSINESS",
      email: "",
      phone: "",
      address: undefined,
    });

    expect(updated).toBe(true);
    expect(dbMock.customer.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "c9", organizationId: "org-1" } }),
    );
    expect(events.emitEvent).toHaveBeenCalledWith("customer.updated", {
      organizationId: "org-1",
      customerId: "c9",
    });
  });

  it("returns false (and emits nothing) for a foreign/absent id", async () => {
    dbMock.customer.updateMany.mockResolvedValue({ count: 0 });
    const updated = await updateCustomerCore(scope, "foreign", {
      name: "X",
      type: "INDIVIDUAL",
      email: "",
      phone: "",
      address: undefined,
    });
    expect(updated).toBe(false);
    expect(events.emitEvent).not.toHaveBeenCalled();
  });
});
