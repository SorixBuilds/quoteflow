import { describe, expect, it } from "vitest";

import { attachFileSchema } from "@/features/files/validation";

const base = { url: "https://cdn.example.com/a.pdf", fileName: "a.pdf", category: "DOCUMENT" as const };

describe("attachFileSchema", () => {
  it("accepts an http(s) URL with a known category", () => {
    expect(attachFileSchema.parse(base).url).toBe(base.url);
    expect(attachFileSchema.parse({ ...base, url: "http://x.test/a.png", category: "PHOTO" })).toBeTruthy();
  });

  it("rejects a non-http scheme (javascript:/data:/file:)", () => {
    expect(() => attachFileSchema.parse({ ...base, url: "javascript:alert(1)" })).toThrow();
    expect(() => attachFileSchema.parse({ ...base, url: "data:text/html,x" })).toThrow();
    expect(() => attachFileSchema.parse({ ...base, url: "file:///etc/passwd" })).toThrow();
  });

  it("rejects an unknown category", () => {
    expect(() => attachFileSchema.parse({ ...base, category: "SECRET" })).toThrow();
  });

  it("requires entityType and entityId together (or neither)", () => {
    // org-level file: neither — ok
    expect(attachFileSchema.parse(base)).toBeTruthy();
    // both — ok
    expect(
      attachFileSchema.parse({
        ...base,
        entityType: "JOB",
        entityId: "11111111-1111-4111-8111-111111111111",
      }),
    ).toBeTruthy();
    // only one — rejected
    expect(() => attachFileSchema.parse({ ...base, entityType: "JOB" })).toThrow();
  });
});
