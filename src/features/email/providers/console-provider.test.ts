import { afterEach, describe, expect, it, vi } from "vitest";

import { ConsoleEmailProvider } from "@/features/email/providers/console-provider";
import { resolveEmailProvider } from "@/features/email/providers/resolve";
import { providerRegistry } from "@/lib/providers/registry";
import type {
  EmailMessage,
  EmailProvider,
} from "@/features/email/providers/types";

vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const MESSAGE: EmailMessage = {
  to: "customer@example.com",
  from: "owner@acme.test",
  subject: "Your quote",
  html: "<p>hi</p>",
  text: "hi",
};

afterEach(() => {
  providerRegistry.reset();
  vi.clearAllMocks();
});

describe("ConsoleEmailProvider (§11.6 zero-cost default)", () => {
  it('identifies as "console"', () => {
    expect(new ConsoleEmailProvider().name).toBe("console");
  });

  it("reports success and never returns a providerMessageId (=> SIMULATED)", async () => {
    const result = await new ConsoleEmailProvider().send(MESSAGE);
    expect(result.success).toBe(true);
    expect(result.providerMessageId).toBeUndefined();
  });
});

describe("resolveEmailProvider (§6.1 resolver)", () => {
  it("returns the console default when EMAIL_PROVIDER is unset/console", () => {
    expect(resolveEmailProvider().name).toBe("console");
  });

  it("honors a DI override without touching env", () => {
    const fake: EmailProvider = {
      name: "fake",
      send: async () => ({ success: true, providerMessageId: "abc" }),
    };
    providerRegistry.override<EmailProvider>("email", () => fake);
    expect(resolveEmailProvider()).toBe(fake);
  });
});
