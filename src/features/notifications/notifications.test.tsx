import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createNotification, markAllRead, markRead } from "@/features/notifications/actions";
import { NotificationCenter } from "@/features/notifications/components/NotificationCenter";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/permissions";
import type { NotificationView } from "@/features/notifications/types";

vi.mock("@/lib/db", () => ({
  db: { notification: { create: vi.fn(), updateMany: vi.fn() } },
}));
vi.mock("@/lib/permissions", () => ({ requireSession: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const session = {
  id: "user-1",
  organizationId: "org-1",
  role: "STAFF" as const,
  name: "Sam",
  email: "sam@acme.test",
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(requireSession).mockResolvedValue(session);
});

describe("notification lifecycle (Step 11)", () => {
  it("createNotification defaults priority and scopes to the caller's org", async () => {
    vi.mocked(db.notification.create).mockResolvedValue({ id: "n1" } as never);
    const result = await createNotification({
      userId: "user-2",
      type: "lead_assigned",
      title: "New lead assigned",
    });
    expect(result).toEqual({ success: true, data: { id: "n1" } });
    expect(db.notification.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          organizationId: "org-1",
          userId: "user-2",
          priority: "NORMAL",
        }),
      }),
    );
  });

  it("markRead updates only the caller's own notification", async () => {
    vi.mocked(db.notification.updateMany).mockResolvedValue({ count: 1 } as never);
    await markRead("n1");
    expect(db.notification.updateMany).toHaveBeenCalledWith({
      where: { id: "n1", userId: "user-1" },
      data: expect.objectContaining({ isRead: true }),
    });
  });

  it("markAllRead reports how many were updated", async () => {
    vi.mocked(db.notification.updateMany).mockResolvedValue({ count: 3 } as never);
    const result = await markAllRead();
    expect(result).toEqual({ success: true, data: { updated: 3 } });
  });
});

const unread: NotificationView = {
  id: "n1",
  type: "lead_assigned",
  title: "New lead assigned",
  body: "Acme Plumbing",
  priority: "NORMAL",
  actionUrl: "/leads/1",
  actionLabel: "View lead",
  isRead: false,
  createdAt: new Date(),
};
const read: NotificationView = {
  ...unread,
  id: "n2",
  title: "Old one",
  isRead: true,
  actionUrl: null,
  actionLabel: null,
};

describe("NotificationCenter (Step 11)", () => {
  it("distinguishes read vs unread and exposes the action label", () => {
    render(
      <NotificationCenter
        notifications={[unread, read]}
        onMarkAllRead={() => {}}
        onItemClick={() => {}}
      />,
    );
    expect(screen.getByText("New lead assigned")).toBeInTheDocument();
    expect(screen.getByText("View lead")).toBeInTheDocument();
    expect(screen.getByLabelText("Unread")).toBeInTheDocument();
  });

  it("invokes mark-all-read", async () => {
    const onMarkAllRead = vi.fn();
    const user = userEvent.setup();
    render(
      <NotificationCenter
        notifications={[unread]}
        onMarkAllRead={onMarkAllRead}
        onItemClick={() => {}}
      />,
    );
    await user.click(screen.getByRole("button", { name: /mark all read/i }));
    expect(onMarkAllRead).toHaveBeenCalledOnce();
  });

  it("shows the empty state when there are none", () => {
    render(
      <NotificationCenter
        notifications={[]}
        onMarkAllRead={() => {}}
        onItemClick={() => {}}
      />,
    );
    expect(screen.getByText(/all caught up/i)).toBeInTheDocument();
  });
});
