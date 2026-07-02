import { afterEach, describe, expect, it } from "vitest";

import { UrlPasteProvider } from "@/features/files/providers/url-paste-provider";
import { resolveStorageProvider } from "@/features/files/providers/resolve";
import { providerRegistry } from "@/lib/providers/registry";
import type { StorageProvider } from "@/features/files/providers/types";

const provider = new UrlPasteProvider();

afterEach(() => {
  providerRegistry.reset();
});

describe("UrlPasteProvider (§14.6 zero-cost default)", () => {
  it('identifies as "url"', () => {
    expect(provider.name).toBe("url");
  });

  it("returns the pasted https URL as the stored reference", async () => {
    const stored = await provider.store({
      fileName: "quote.pdf",
      url: "https://example.com/quote.pdf",
    });
    expect(stored.url).toBe("https://example.com/quote.pdf");
    expect(stored.fileName).toBe("quote.pdf");
    expect(stored.sizeBytes).toBeUndefined();
  });

  it("accepts http URLs", async () => {
    const stored = await provider.store({
      fileName: "f",
      url: "http://example.com/f",
    });
    expect(stored.url).toBe("http://example.com/f");
  });

  it("rejects a missing URL", async () => {
    await expect(provider.store({ fileName: "f" })).rejects.toThrow(/required/i);
  });

  it("rejects a malformed URL", async () => {
    await expect(
      provider.store({ fileName: "f", url: "not a url" }),
    ).rejects.toThrow(/valid URL/i);
  });

  it("rejects non-http(s) schemes (javascript:, data:, file:)", async () => {
    for (const url of [
      "javascript:alert(1)",
      "data:text/html,<script>",
      "file:///etc/passwd",
    ]) {
      await expect(provider.store({ fileName: "f", url })).rejects.toThrow(
        /http and https/i,
      );
    }
  });

  it("trims surrounding whitespace", async () => {
    const stored = await provider.store({
      fileName: "  f  ",
      url: "  https://example.com/x  ",
    });
    expect(stored.url).toBe("https://example.com/x");
    expect(stored.fileName).toBe("f");
  });
});

describe("resolveStorageProvider (§6.1 resolver)", () => {
  it("returns the url-paste default", () => {
    expect(resolveStorageProvider().name).toBe("url");
  });

  it("honors a DI override", () => {
    const fake: StorageProvider = {
      name: "fake",
      store: async () => ({ url: "x", fileName: "x" }),
    };
    providerRegistry.override<StorageProvider>("storage", () => fake);
    expect(resolveStorageProvider()).toBe(fake);
  });
});
