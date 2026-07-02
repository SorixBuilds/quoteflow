import { describe, expect, it } from "vitest";

import { buildJobSummaryPrompt, buildQuotePrompt } from "@/features/ai/prompts";

/**
 * §16.9: prompt builders are pure string composition over the pre-scoped facts
 * they are handed — they include exactly those facts, omit absent ones, and
 * (having no DB access at all) cannot be made to include another
 * organization's data by any input.
 */

describe("buildQuotePrompt", () => {
  it("includes every provided fact", () => {
    const prompt = buildQuotePrompt({
      leadName: "Ada Lovelace",
      leadPhone: "555-0100",
      leadEmail: "ada@example.test",
      sourceName: "Referral",
      customerName: "Lovelace Ltd",
    });
    for (const fact of ["Ada Lovelace", "555-0100", "ada@example.test", "Referral", "Lovelace Ltd"]) {
      expect(prompt).toContain(fact);
    }
    expect(prompt).toContain("no markdown");
  });

  it("omits absent optional facts entirely", () => {
    const prompt = buildQuotePrompt({
      leadName: "Ada",
      leadPhone: "555-0100",
      leadEmail: null,
      sourceName: null,
      customerName: null,
    });
    expect(prompt).not.toContain("Email:");
    expect(prompt).not.toContain("Lead source:");
    expect(prompt).not.toContain("Existing customer record:");
  });
});

describe("buildJobSummaryPrompt", () => {
  it("carries the technician's raw notes into the prompt when present", () => {
    const prompt = buildJobSummaryPrompt({
      customerName: "Acme",
      quoteNumber: "Q-7",
      status: "COMPLETED",
      scheduledDate: "2026-06-30",
      completedAt: "2026-07-01",
      existingNotes: "replaced filter, flushed system",
    });
    expect(prompt).toContain("replaced filter, flushed system");
    expect(prompt).toContain("Q-7");
    expect(prompt).toContain("do not invent");
  });

  it("omits the notes line when there are none", () => {
    const prompt = buildJobSummaryPrompt({
      customerName: "Acme",
      quoteNumber: "Q-7",
      status: "SCHEDULED",
      scheduledDate: null,
      completedAt: null,
      existingNotes: null,
    });
    expect(prompt).not.toContain("Technician's raw notes so far:");
  });
});
