import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { perms, flags, dbMock, providers, repo } = vi.hoisted(() => ({
  perms: {
    requireSession: vi.fn(),
    requireActiveUser: vi.fn(),
    requireCompanyScope: vi.fn(),
  },
  flags: { isFeatureEnabled: vi.fn() },
  dbMock: { lead: { findFirst: vi.fn() }, job: { findFirst: vi.fn() } },
  providers: { resolveAiProvider: vi.fn() },
  repo: { recordAiUsage: vi.fn() },
}));

vi.mock("next/navigation", () => ({ unstable_rethrow: vi.fn() }));
vi.mock("@/lib/permissions", () => perms);
vi.mock("@/lib/config/flags", () => flags);
vi.mock("@/lib/db", () => ({ db: dbMock }));
vi.mock("@/features/ai/providers/resolve", () => providers);
vi.mock("@/features/ai/repository", () => repo);
vi.mock("@/lib/logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));

import { generateQuoteDraft, summarizeJob } from "@/features/ai/actions";

/**
 * §16.12: flag-off means zero provider work; every real call writes an
 * AiUsageLog with tokens/cost; entity loads are organization-scoped so a
 * foreign id can never feed the prompt builder; provider failure degrades to
 * the calm §16.10 message.
 */

const session = {
  id: "u1",
  organizationId: "org-1",
  role: "STAFF" as const,
  name: "Dana",
  email: "dana@acme.test",
};

const lead = {
  name: "Ada Lovelace",
  phone: "555-0100",
  email: "ada@example.test",
  source: { name: "Referral" },
  customer: null,
};

function mockProvider(result: { text: string; tokensUsed: number; costEstimate: number }) {
  const complete = vi.fn().mockResolvedValue(result);
  providers.resolveAiProvider.mockReturnValue({ name: "mock", complete });
  return complete;
}

beforeEach(() => {
  perms.requireSession.mockResolvedValue(session);
  perms.requireCompanyScope.mockResolvedValue({ organizationId: "org-1" });
  flags.isFeatureEnabled.mockResolvedValue(true);
  dbMock.lead.findFirst.mockResolvedValue(lead);
  repo.recordAiUsage.mockResolvedValue({});
});
afterEach(() => vi.clearAllMocks());

describe("generateQuoteDraft — flag gate (§16.10, §16.12)", () => {
  it("returns a failure and touches NOTHING ai-related when the flag is off", async () => {
    flags.isFeatureEnabled.mockResolvedValue(false);

    const result = await generateQuoteDraft("lead-1");

    expect(result).toEqual({ success: false, error: "AI features are not enabled." });
    expect(providers.resolveAiProvider).not.toHaveBeenCalled();
    expect(repo.recordAiUsage).not.toHaveBeenCalled();
    expect(dbMock.lead.findFirst).not.toHaveBeenCalled();
  });
});

describe("generateQuoteDraft — happy path (§16.6)", () => {
  it("builds the prompt from the org-scoped lead, returns text, and logs usage", async () => {
    const complete = mockProvider({ text: "Thanks for your enquiry…", tokensUsed: 42, costEstimate: 0.0123 });

    const result = await generateQuoteDraft("lead-1");

    expect(dbMock.lead.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "lead-1", organizationId: "org-1" } }),
    );
    const promptArg = complete.mock.calls[0][0];
    expect(promptArg.feature).toBe("quote_draft");
    expect(promptArg.prompt).toContain("Ada Lovelace");
    expect(promptArg.prompt).toContain("Referral");
    expect(repo.recordAiUsage).toHaveBeenCalledWith("org-1", "u1", {
      feature: "quote_draft",
      provider: "mock",
      tokensUsed: 42,
      costEstimate: "0.0123",
    });
    expect(result).toEqual({ success: true, data: "Thanks for your enquiry…" });
  });

  it("degrades to the calm unavailable message when the provider errors", async () => {
    providers.resolveAiProvider.mockReturnValue({
      name: "mock",
      complete: vi.fn().mockRejectedValue(new Error("rate limited")),
    });
    const result = await generateQuoteDraft("lead-1");
    expect(result).toEqual({ success: false, error: "AI suggestion unavailable right now." });
  });

  it("treats an empty completion (null provider misconfig) as unavailable — but still logs usage", async () => {
    mockProvider({ text: "", tokensUsed: 0, costEstimate: 0 });
    const result = await generateQuoteDraft("lead-1");
    expect(result).toEqual({ success: false, error: "AI suggestion unavailable right now." });
    expect(repo.recordAiUsage).toHaveBeenCalledOnce();
  });
});

describe("organization scoping (§16.9)", () => {
  it("a foreign/absent lead fails before any provider call", async () => {
    dbMock.lead.findFirst.mockResolvedValue(null);
    const result = await generateQuoteDraft("foreign-lead");
    expect(result).toEqual({ success: false, error: "Lead not found." });
    expect(providers.resolveAiProvider).not.toHaveBeenCalled();
  });

  it("FIELD can only summarize their OWN assigned job (§16.8)", async () => {
    perms.requireSession.mockResolvedValue({ ...session, role: "FIELD" });
    dbMock.job.findFirst.mockResolvedValue({
      status: "COMPLETED",
      scheduledDate: null,
      completedAt: new Date("2026-07-01T00:00:00Z"),
      notes: null,
      assignedToId: "someone-else",
      customer: { name: "Acme" },
      quote: { quoteNumber: "Q-1" },
    });

    const result = await summarizeJob("job-1");
    expect(result).toEqual({ success: false, error: "Job not found." });
    expect(providers.resolveAiProvider).not.toHaveBeenCalled();
  });

  it("summarizeJob logs usage under job_summary for an allowed caller", async () => {
    mockProvider({ text: "Work completed as quoted.", tokensUsed: 10, costEstimate: 0.001 });
    dbMock.job.findFirst.mockResolvedValue({
      status: "COMPLETED",
      scheduledDate: new Date("2026-06-30T00:00:00Z"),
      completedAt: new Date("2026-07-01T00:00:00Z"),
      notes: "replaced filter",
      assignedToId: "u1",
      customer: { name: "Acme" },
      quote: { quoteNumber: "Q-7" },
    });

    const result = await summarizeJob("job-1");
    expect(result).toEqual({ success: true, data: "Work completed as quoted." });
    expect(repo.recordAiUsage).toHaveBeenCalledWith(
      "org-1",
      "u1",
      expect.objectContaining({ feature: "job_summary" }),
    );
  });
});
