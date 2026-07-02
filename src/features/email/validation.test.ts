import { describe, expect, it } from "vitest";

import { createEmailLogSchema } from "@/features/email/validation";

const base = {
  toEmail: "client@example.com",
  fromEmail: "noreply@acme.test",
  subject: "Your quote",
  templateType: "quote_sent",
};

describe("createEmailLogSchema", () => {
  it("accepts a well-formed log input", () => {
    expect(createEmailLogSchema.parse(base).toEmail).toBe(base.toEmail);
  });

  it("rejects a malformed recipient address", () => {
    expect(() => createEmailLogSchema.parse({ ...base, toEmail: "not-an-email" })).toThrow();
  });

  it("rejects an unknown status", () => {
    expect(() => createEmailLogSchema.parse({ ...base, status: "WHATEVER" })).toThrow();
  });
});
