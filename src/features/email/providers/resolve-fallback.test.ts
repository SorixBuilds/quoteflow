import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

// A mutable env stand-in — the resolver reads these at call time, so each test
// can flip the provider/key without re-importing. Hoisted so the mock factory
// (also hoisted) can reference it.
const { envState } = vi.hoisted(() => ({
  envState: { EMAIL_PROVIDER: "resend", RESEND_API_KEY: undefined } as {
    EMAIL_PROVIDER: "console" | "resend";
    RESEND_API_KEY?: string;
  },
}));
vi.mock("@/lib/env", () => ({ env: envState }));

import { resolveEmailProvider } from "@/features/email/providers/resolve";
import { providerRegistry } from "@/lib/providers/registry";
import { logger } from "@/lib/logger";

afterEach(() => {
  providerRegistry.reset();
  vi.clearAllMocks();
});

describe("resolveEmailProvider — resend funding (§11.13, graceful fallback)", () => {
  it("uses ResendEmailProvider when a key is configured", () => {
    envState.EMAIL_PROVIDER = "resend";
    envState.RESEND_API_KEY = "sk_live";
    expect(resolveEmailProvider().name).toBe("resend");
  });

  it("degrades to console (with a warning) when resend is selected but the key is missing", () => {
    envState.EMAIL_PROVIDER = "resend";
    envState.RESEND_API_KEY = undefined;
    expect(resolveEmailProvider().name).toBe("console");
    expect(logger.warn).toHaveBeenCalledOnce();
  });
});
