import { afterEach, describe, expect, it, vi } from "vitest";

import { NullAIProvider } from "@/features/ai/providers/null-provider";
import { resolveAiProvider } from "@/features/ai/providers/resolve";
import { providerRegistry } from "@/lib/providers/registry";
import type { AIProvider } from "@/features/ai/providers/types";

afterEach(() => {
  providerRegistry.reset();
});

describe("NullAIProvider (§16.6 zero-cost default)", () => {
  it('identifies as "null"', () => {
    expect(new NullAIProvider().name).toBe("null");
  });

  it("returns an empty completion with zero usage and zero cost", async () => {
    const result = await new NullAIProvider().complete({
      prompt: "draft a quote",
      feature: "quote_draft",
    });
    expect(result).toEqual({ text: "", tokensUsed: 0, costEstimate: 0 });
  });

  it("makes no network call (no fetch invoked)", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    await new NullAIProvider().complete({ prompt: "x", feature: "f" });
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });
});

describe("resolveAiProvider (§6.1 resolver)", () => {
  it("returns the null default", () => {
    expect(resolveAiProvider().name).toBe("null");
  });

  it("honors a DI override (mocked funded provider)", () => {
    const fake: AIProvider = {
      name: "anthropic",
      complete: async () => ({ text: "hi", tokensUsed: 10, costEstimate: 0.01 }),
    };
    providerRegistry.override<AIProvider>("ai", () => fake);
    expect(resolveAiProvider()).toBe(fake);
  });
});
