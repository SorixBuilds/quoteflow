import { describe, expect, it } from "vitest";

import {
  canTransitionJob,
  canTransitionLead,
  canTransitionQuote,
  deriveInvoiceStatus,
  nextLeadStatuses,
  nextQuoteStatuses,
} from "@/lib/status";
import { toDecimal } from "@/lib/money";

/**
 * Status lifecycle tests (Phase 5, §22, §40). Every legal transition is allowed
 * and every illegal one rejected — the same maps the server actions and the
 * transition menu both consume.
 */
describe("lead transitions", () => {
  it("allows the forward path and loss from any non-terminal", () => {
    expect(canTransitionLead("NEW", "CONTACTED")).toBe(true);
    expect(canTransitionLead("CONTACTED", "QUOTED")).toBe(true);
    expect(canTransitionLead("QUOTED", "WON")).toBe(true);
    expect(canTransitionLead("NEW", "LOST")).toBe(true);
    expect(canTransitionLead("QUOTED", "LOST")).toBe(true);
  });
  it("rejects illegal transitions and any move out of a terminal state", () => {
    expect(canTransitionLead("NEW", "WON")).toBe(false);
    expect(canTransitionLead("WON", "LOST")).toBe(false);
    expect(canTransitionLead("LOST", "NEW")).toBe(false);
  });
  it("exposes only legal next statuses", () => {
    expect(nextLeadStatuses("NEW").sort()).toEqual(["CONTACTED", "LOST"]);
    expect(nextLeadStatuses("WON")).toEqual([]);
  });
});

describe("quote transitions", () => {
  it("allows the send/view/accept/decline/expire paths", () => {
    expect(canTransitionQuote("DRAFT", "SENT")).toBe(true);
    expect(canTransitionQuote("SENT", "VIEWED")).toBe(true);
    expect(canTransitionQuote("SENT", "ACCEPTED")).toBe(true);
    expect(canTransitionQuote("VIEWED", "DECLINED")).toBe(true);
    expect(canTransitionQuote("SENT", "EXPIRED")).toBe(true);
  });
  it("treats ACCEPTED as final", () => {
    expect(canTransitionQuote("ACCEPTED", "DECLINED")).toBe(false);
    expect(canTransitionQuote("ACCEPTED", "EXPIRED")).toBe(false);
    expect(nextQuoteStatuses("ACCEPTED")).toEqual([]);
  });
  it("rejects skipping straight from DRAFT to ACCEPTED", () => {
    expect(canTransitionQuote("DRAFT", "ACCEPTED")).toBe(false);
  });
});

describe("job transitions", () => {
  it("allows scheduled → in_progress → completed and cancellation", () => {
    expect(canTransitionJob("SCHEDULED", "IN_PROGRESS")).toBe(true);
    expect(canTransitionJob("IN_PROGRESS", "COMPLETED")).toBe(true);
    expect(canTransitionJob("SCHEDULED", "CANCELLED")).toBe(true);
  });
  it("rejects moving out of a terminal state", () => {
    expect(canTransitionJob("COMPLETED", "IN_PROGRESS")).toBe(false);
    expect(canTransitionJob("CANCELLED", "SCHEDULED")).toBe(false);
  });
});

describe("deriveInvoiceStatus", () => {
  it("is UNPAID at zero", () => {
    expect(deriveInvoiceStatus(toDecimal("100"), toDecimal("0"))).toBe("UNPAID");
  });
  it("is PARTIAL between zero and the amount", () => {
    expect(deriveInvoiceStatus(toDecimal("100"), toDecimal("40"))).toBe("PARTIAL");
  });
  it("is PAID at or above the amount", () => {
    expect(deriveInvoiceStatus(toDecimal("100"), toDecimal("100"))).toBe("PAID");
    expect(deriveInvoiceStatus(toDecimal("100"), toDecimal("120"))).toBe("PAID");
  });
});
