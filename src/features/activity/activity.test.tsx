import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ActivityTimelineView } from "@/features/activity/components/ActivityTimeline";
import { getActivityForEntity } from "@/features/activity/queries";
import { logActivity } from "@/features/activity/actions";
import { db } from "@/lib/db";

vi.mock("@/lib/db", () => ({
  db: { activity: { findMany: vi.fn(), create: vi.fn() } },
}));

beforeEach(() => vi.clearAllMocks());

describe("getActivityForEntity (Step 10)", () => {
  it("queries newest-first, company-scoped, by polymorphic key", async () => {
    vi.mocked(db.activity.findMany).mockResolvedValue([
      {
        id: "a1",
        type: "created",
        message: null,
        createdAt: new Date(),
        createdBy: { name: "Dana" },
      },
    ] as never);

    const result = await getActivityForEntity("org-1", "LEAD", "lead-1");

    expect(db.activity.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { organizationId: "org-1", entityType: "LEAD", entityId: "lead-1" },
        orderBy: { createdAt: "desc" },
        take: 50,
      }),
    );
    expect(result[0]).toMatchObject({ type: "created", actorName: "Dana" });
  });
});

describe("logActivity (Step 10)", () => {
  it("writes a row with the polymorphic fields", async () => {
    await logActivity({
      organizationId: "org-1",
      entityType: "QUOTE",
      entityId: "quote-1",
      type: "quote_sent",
      message: "Sent to client",
      createdById: "user-1",
    });
    expect(db.activity.create).toHaveBeenCalledWith({
      data: {
        organizationId: "org-1",
        entityType: "QUOTE",
        entityId: "quote-1",
        type: "quote_sent",
        message: "Sent to client",
        createdById: "user-1",
      },
    });
  });
});

describe("ActivityTimelineView (Step 10)", () => {
  it("renders the empty state with no entries", () => {
    render(<ActivityTimelineView entries={[]} />);
    expect(screen.getByText(/no activity yet/i)).toBeInTheDocument();
  });

  it("renders an event label and actor for an entry", () => {
    render(
      <ActivityTimelineView
        entries={[
          {
            id: "a1",
            type: "settings_updated",
            message: null,
            createdAt: new Date("2026-01-01T00:00:00Z"),
            actorName: "Dana",
          },
        ]}
      />,
    );
    expect(screen.getByText("Settings updated")).toBeInTheDocument();
    expect(screen.getByText(/Dana/)).toBeInTheDocument();
  });
});
