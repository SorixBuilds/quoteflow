import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { repo } = vi.hoisted(() => ({
  repo: {
    listActiveWebhooksForEvent: vi.fn(),
    createWebhookDelivery: vi.fn(),
    updateWebhookDelivery: vi.fn(),
    listDueDeliveries: vi.fn(),
    findWebhookForDispatch: vi.fn(),
  },
}));

vi.mock("@/features/webhooks/repository", () => repo);
vi.mock("@/lib/logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));

import {
  dispatchWebhooks,
  processDueWebhookDeliveries,
} from "@/features/webhooks/dispatch";
import { verifySignatureHeader } from "@/features/webhooks/sign";

/**
 * §21.12 dispatch tests: fan-out creates one delivery per subscribed webhook;
 * a 2xx marks SUCCESS with the response code; a failure schedules a
 * backoff-spaced retry; the 5-attempt cap is terminal; the payload crossing
 * the wire is HMAC-signed and verifiable; nothing ever throws into the
 * publishing business action.
 */

const HOOK = {
  id: "wh-1",
  organizationId: "org-1",
  url: "https://receiver.test/hook",
  secret: "whsec_abc",
  subscribedEvents: ["quote.accepted"],
  isActive: true,
  createdById: "u1",
  createdAt: new Date(),
};

function delivery(overrides: Record<string, unknown> = {}) {
  return {
    id: "d1",
    webhookId: "wh-1",
    eventType: "quote.accepted",
    payload: { event: "quote.accepted", occurredAt: "2026-07-02T00:00:00.000Z", data: { organizationId: "org-1", quoteId: "q1" } },
    status: "PENDING",
    responseStatusCode: null,
    attempts: 0,
    lastAttemptAt: null,
    nextRetryAt: null,
    createdAt: new Date("2026-07-02T00:00:00Z"),
    ...overrides,
  };
}

const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  repo.listActiveWebhooksForEvent.mockResolvedValue([HOOK]);
  repo.createWebhookDelivery.mockResolvedValue(delivery());
  repo.updateWebhookDelivery.mockResolvedValue({});
  repo.listDueDeliveries.mockResolvedValue([]);
  repo.findWebhookForDispatch.mockResolvedValue(HOOK);
  fetchMock.mockResolvedValue(new Response("ok", { status: 200 }));
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("dispatchWebhooks — fan-out and success", () => {
  it("creates one delivery per subscribed webhook and marks it SUCCESS", async () => {
    await dispatchWebhooks("quote.accepted", { organizationId: "org-1", quoteId: "q1" });

    expect(repo.listActiveWebhooksForEvent).toHaveBeenCalledWith("org-1", "quote.accepted");
    expect(repo.createWebhookDelivery).toHaveBeenCalledWith(
      expect.objectContaining({ webhookId: "wh-1", eventType: "quote.accepted" }),
    );
    expect(repo.updateWebhookDelivery).toHaveBeenCalledWith(
      "d1",
      expect.objectContaining({ status: "SUCCESS", responseStatusCode: 200, incrementAttempt: true }),
    );
  });

  it("sends a signed, verifiable payload with event/delivery headers", async () => {
    await dispatchWebhooks("quote.accepted", { organizationId: "org-1", quoteId: "q1" });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(HOOK.url);
    const headers = init.headers as Record<string, string>;
    expect(headers["X-QuoteFlow-Event"]).toBe("quote.accepted");
    expect(headers["X-QuoteFlow-Delivery"]).toBe("d1");
    const body = init.body as string;
    expect(JSON.parse(body)).toMatchObject({ id: "d1", event: "quote.accepted" });
    expect(
      verifySignatureHeader(HOOK.secret, headers["X-QuoteFlow-Signature"], body, {
        now: Math.floor(Date.now() / 1000),
      }),
    ).toBe(true);
  });

  it("does nothing (and never fetches) when no webhook subscribes", async () => {
    repo.listActiveWebhooksForEvent.mockResolvedValue([]);
    await dispatchWebhooks("quote.accepted", { organizationId: "org-1", quoteId: "q1" });
    expect(repo.createWebhookDelivery).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("dispatchWebhooks — failure and retry (§21.7)", () => {
  it("marks FAILED with a backoff-scheduled nextRetryAt on a 500", async () => {
    fetchMock.mockResolvedValue(new Response("boom", { status: 500 }));

    await dispatchWebhooks("quote.accepted", { organizationId: "org-1", quoteId: "q1" });

    const update = repo.updateWebhookDelivery.mock.calls[0][1];
    expect(update.status).toBe("FAILED");
    expect(update.responseStatusCode).toBe(500);
    expect(update.incrementAttempt).toBe(true);
    expect(update.nextRetryAt).toBeInstanceOf(Date);
    expect(update.nextRetryAt.getTime()).toBeGreaterThan(Date.now());
  });

  it("marks FAILED with no status code on a network error, without throwing", async () => {
    fetchMock.mockRejectedValue(new Error("ECONNREFUSED"));

    await expect(
      dispatchWebhooks("quote.accepted", { organizationId: "org-1", quoteId: "q1" }),
    ).resolves.toBeUndefined();

    const update = repo.updateWebhookDelivery.mock.calls[0][1];
    expect(update.status).toBe("FAILED");
    expect(update.responseStatusCode).toBeNull();
  });

  it("goes terminal (no nextRetryAt) at the 5-attempt cap", async () => {
    fetchMock.mockResolvedValue(new Response("boom", { status: 500 }));
    repo.listDueDeliveries.mockResolvedValue([delivery({ attempts: 4, status: "FAILED" })]);

    await processDueWebhookDeliveries();

    const update = repo.updateWebhookDelivery.mock.calls[0][1];
    expect(update.status).toBe("FAILED");
    expect(update.nextRetryAt).toBeNull();
  });

  it("never throws even when the repository itself fails", async () => {
    repo.listActiveWebhooksForEvent.mockRejectedValue(new Error("db down"));
    await expect(
      dispatchWebhooks("quote.accepted", { organizationId: "org-1", quoteId: "q1" }),
    ).resolves.toBeUndefined();
  });
});

describe("processDueWebhookDeliveries — lazy drain", () => {
  it("re-attempts a due delivery through its parent webhook", async () => {
    repo.listDueDeliveries.mockResolvedValue([delivery({ attempts: 1, status: "FAILED" })]);

    await processDueWebhookDeliveries(10);

    expect(repo.findWebhookForDispatch).toHaveBeenCalledWith("wh-1");
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(repo.updateWebhookDelivery).toHaveBeenCalledWith(
      "d1",
      expect.objectContaining({ status: "SUCCESS" }),
    );
  });

  it("skips deliveries whose webhook was deactivated or deleted", async () => {
    repo.listDueDeliveries.mockResolvedValue([delivery()]);
    repo.findWebhookForDispatch.mockResolvedValue({ ...HOOK, isActive: false });

    await processDueWebhookDeliveries(10);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
