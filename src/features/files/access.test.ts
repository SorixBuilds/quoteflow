import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({
  db: {
    job: { findFirst: vi.fn() },
    lead: { findFirst: vi.fn() },
    quote: { findFirst: vi.fn() },
    customer: { findFirst: vi.fn() },
    invoice: { findFirst: vi.fn() },
  },
}));

import { db } from "@/lib/db";
import { canManageAttachmentTarget, type FileScope } from "@/features/files/access";

const owner: FileScope = { organizationId: "org-1", role: "OWNER", userId: "u-owner" };
const staff: FileScope = { organizationId: "org-1", role: "STAFF", userId: "u-staff" };
const field: FileScope = { organizationId: "org-1", role: "FIELD", userId: "u-field" };

beforeEach(() => {
  vi.clearAllMocks();
});

describe("canManageAttachmentTarget — organization-level files (§14.8)", () => {
  it("allows OWNER, denies STAFF and FIELD", async () => {
    expect(await canManageAttachmentTarget(owner, null, null)).toBe(true);
    expect(await canManageAttachmentTarget(staff, null, null)).toBe(false);
    expect(await canManageAttachmentTarget(field, null, null)).toBe(false);
  });
});

describe("canManageAttachmentTarget — business entities (§14.8)", () => {
  it("lets OWNER/STAFF manage a Lead that exists in their org", async () => {
    vi.mocked(db.lead.findFirst).mockResolvedValue({ id: "l1" } as never);
    expect(await canManageAttachmentTarget(owner, "LEAD", "l1")).toBe(true);
    expect(await canManageAttachmentTarget(staff, "LEAD", "l1")).toBe(true);
    expect(db.lead.findFirst).toHaveBeenCalledWith({
      where: { id: "l1", organizationId: "org-1" },
      select: { id: true },
    });
  });

  it("denies a Lead that does not exist in the caller's org (IDOR / cross-tenant)", async () => {
    vi.mocked(db.lead.findFirst).mockResolvedValue(null);
    expect(await canManageAttachmentTarget(owner, "LEAD", "other-org-lead")).toBe(false);
  });

  it("forbids FIELD from managing non-Job entities without ever querying", async () => {
    expect(await canManageAttachmentTarget(field, "QUOTE", "q1")).toBe(false);
    expect(await canManageAttachmentTarget(field, "INVOICE", "i1")).toBe(false);
    expect(db.quote.findFirst).not.toHaveBeenCalled();
    expect(db.invoice.findFirst).not.toHaveBeenCalled();
  });
});

describe("canManageAttachmentTarget — Jobs and the FIELD per-row tier (§14.8, §29)", () => {
  it("scopes a FIELD user's Job to self-assignment", async () => {
    vi.mocked(db.job.findFirst).mockResolvedValue({ id: "j1" } as never);
    const ok = await canManageAttachmentTarget(field, "JOB", "j1");
    expect(ok).toBe(true);
    expect(db.job.findFirst).toHaveBeenCalledWith({
      where: { id: "j1", organizationId: "org-1", assignedToId: "u-field" },
      select: { id: true },
    });
  });

  it("denies a FIELD user a Job assigned to someone else (query returns null)", async () => {
    vi.mocked(db.job.findFirst).mockResolvedValue(null);
    expect(await canManageAttachmentTarget(field, "JOB", "j-other")).toBe(false);
  });

  it("does NOT restrict an OWNER's Job to a single assignee", async () => {
    vi.mocked(db.job.findFirst).mockResolvedValue({ id: "j1" } as never);
    await canManageAttachmentTarget(owner, "JOB", "j1");
    expect(db.job.findFirst).toHaveBeenCalledWith({
      where: { id: "j1", organizationId: "org-1" },
      select: { id: true },
    });
  });
});
