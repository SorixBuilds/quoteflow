import { beforeEach, describe, expect, it, vi } from "vitest";

import { InMemoryJobQueue } from "@/lib/jobs/in-memory-queue";
import { InMemoryJobScheduler } from "@/lib/jobs/scheduler";

vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const T0 = 1_700_000_000_000;
let queue: InMemoryJobQueue;

beforeEach(() => {
  queue = new InMemoryJobQueue();
});

describe("InMemoryJobQueue (§6 background job foundation)", () => {
  it("runs a registered job to completion", async () => {
    const handler = vi.fn();
    queue.register({ name: "noop", handler });
    const id = await queue.enqueue("noop", { x: 1 });

    const summary = await queue.process(T0);

    expect(handler).toHaveBeenCalledWith({ x: 1 }, { attempt: 1 });
    expect(summary).toMatchObject({ ran: 1, completed: 1, failed: 0 });
    expect(queue.get(id)?.status).toBe("completed");
  });

  it("refuses to enqueue an unregistered job", async () => {
    await expect(queue.enqueue("ghost", {})).rejects.toThrow(/No job registered/);
  });

  it("retries a failing job with backoff, then succeeds", async () => {
    let calls = 0;
    queue.register({
      name: "flaky",
      handler: () => {
        calls += 1;
        if (calls < 2) throw new Error("transient");
      },
      retry: { maxAttempts: 3, baseDelayMs: 1_000, maxDelayMs: 10_000 },
    });
    const id = await queue.enqueue("flaky", {});

    // First drain: fails, scheduled for retry (not yet due again).
    const first = await queue.process(T0);
    expect(first).toMatchObject({ ran: 1, failed: 0, retried: 1 });
    expect(queue.get(id)?.status).toBe("pending");
    expect(queue.get(id)?.attempts).toBe(1);

    // Not due yet → skipped.
    const tooEarly = await queue.process(T0 + 1);
    expect(tooEarly.ran).toBe(0);

    // After the backoff elapses → runs again and completes.
    const second = await queue.process(T0 + 1_000);
    expect(second).toMatchObject({ ran: 1, completed: 1 });
    expect(queue.get(id)?.status).toBe("completed");
    expect(calls).toBe(2);
  });

  it("marks a job failed once retries are exhausted", async () => {
    queue.register({
      name: "always-fails",
      handler: () => {
        throw new Error("permanent");
      },
      retry: { maxAttempts: 2, baseDelayMs: 0, maxDelayMs: 0 },
    });
    const id = await queue.enqueue("always-fails", {});

    await queue.process(T0); // attempt 1 → retry
    const final = await queue.process(T0); // attempt 2 → failed

    expect(final).toMatchObject({ failed: 1 });
    expect(queue.get(id)?.status).toBe("failed");
    expect(queue.get(id)?.lastError).toBe("permanent");
  });

  it("a failing job never throws out of process()", async () => {
    queue.register({
      name: "boom",
      handler: () => {
        throw new Error("boom");
      },
      retry: { maxAttempts: 1, baseDelayMs: 0, maxDelayMs: 0 },
    });
    await queue.enqueue("boom", {});
    await expect(queue.process(T0)).resolves.toMatchObject({ failed: 1 });
  });
});

describe("InMemoryJobScheduler (§15.13)", () => {
  it("reports a never-run job as due", () => {
    const s = new InMemoryJobScheduler();
    s.schedule("sweep", 60_000);
    expect(s.due(T0)).toContain("sweep");
  });

  it("suppresses a job until its interval elapses, then reports it due again", () => {
    const s = new InMemoryJobScheduler();
    s.schedule("sweep", 60_000);
    s.markRan("sweep", T0);
    expect(s.due(T0 + 1_000)).not.toContain("sweep");
    expect(s.due(T0 + 60_000)).toContain("sweep");
  });
});
