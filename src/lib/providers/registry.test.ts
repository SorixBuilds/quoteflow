import { afterEach, describe, expect, it, vi } from "vitest";

import { providerRegistry } from "@/lib/providers/registry";

type Greeter = { name: string; greet: () => string };

const KEY = "test-slot";
const makeDefault = (): Greeter => ({ name: "default", greet: () => "default" });

afterEach(() => {
  providerRegistry.reset();
});

describe("ProviderRegistry (§6.1 dependency injection)", () => {
  it("returns the default factory when no override is installed", () => {
    const provider = providerRegistry.resolve(KEY, makeDefault);
    expect(provider.greet()).toBe("default");
    expect(providerRegistry.hasOverride(KEY)).toBe(false);
  });

  it("returns an installed override instead of the default", () => {
    providerRegistry.override<Greeter>(KEY, () => ({
      name: "override",
      greet: () => "override",
    }));
    expect(providerRegistry.resolve(KEY, makeDefault).greet()).toBe("override");
    expect(providerRegistry.hasOverride(KEY)).toBe(true);
  });

  it("disposer removes exactly the override it installed", () => {
    const dispose = providerRegistry.override<Greeter>(KEY, () => ({
      name: "override",
      greet: () => "override",
    }));
    dispose();
    expect(providerRegistry.hasOverride(KEY)).toBe(false);
    expect(providerRegistry.resolve(KEY, makeDefault).greet()).toBe("default");
  });

  it("clearOverride falls back to the default factory", () => {
    providerRegistry.override<Greeter>(KEY, () => ({
      name: "override",
      greet: () => "override",
    }));
    providerRegistry.clearOverride(KEY);
    expect(providerRegistry.resolve(KEY, makeDefault).greet()).toBe("default");
  });

  it("constructs a fresh instance on every resolve (stateless providers)", () => {
    const a = providerRegistry.resolve(KEY, makeDefault);
    const b = providerRegistry.resolve(KEY, makeDefault);
    expect(a).not.toBe(b);
  });

  it("gracefully falls back to the default when an override factory throws", () => {
    providerRegistry.override<Greeter>(KEY, () => {
      throw new Error("misconfigured adapter");
    });
    // Must not throw — the broken override degrades to the zero-cost default.
    const provider = providerRegistry.resolve(KEY, makeDefault);
    expect(provider.greet()).toBe("default");
  });

  it("reset() drops every override", () => {
    providerRegistry.override<Greeter>(KEY, () => ({
      name: "override",
      greet: () => "override",
    }));
    providerRegistry.reset();
    expect(providerRegistry.hasOverride(KEY)).toBe(false);
  });

  it("isolates overrides per slot", () => {
    providerRegistry.override<Greeter>("a", () => ({
      name: "a",
      greet: () => "a",
    }));
    expect(providerRegistry.resolve("a", makeDefault).greet()).toBe("a");
    expect(providerRegistry.resolve("b", makeDefault).greet()).toBe("default");
  });
});

// Silence the expected fallback log assertion noise without coupling the test
// to the logger's shape.
vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));
