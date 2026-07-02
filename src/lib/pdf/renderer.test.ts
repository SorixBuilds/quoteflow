import { afterEach, describe, expect, it } from "vitest";

import {
  UnconfiguredDocumentRenderer,
  resolveDocumentRenderer,
} from "@/lib/pdf/renderer";
import { ProviderNotConfiguredError } from "@/lib/providers/types";
import { providerRegistry } from "@/lib/providers/registry";
import type { DocumentRenderer } from "@/lib/pdf/renderer";

afterEach(() => {
  providerRegistry.reset();
});

describe("DocumentRenderer foundation (§10.6)", () => {
  it("resolver returns the production renderer by default (Step 2)", () => {
    expect(resolveDocumentRenderer().name).toBe("react-pdf");
  });

  it("the retained placeholder throws a typed not-configured error on render", async () => {
    await expect(
      new UnconfiguredDocumentRenderer().render({} as never),
    ).rejects.toBeInstanceOf(ProviderNotConfiguredError);
  });

  it("honors a DI override (Step 2 will register the real renderer this way)", async () => {
    const fake: DocumentRenderer = {
      name: "fake-test-renderer",
      render: async () => Buffer.from("PDF"),
    };
    providerRegistry.override<DocumentRenderer>("document-renderer", () => fake);
    const renderer = resolveDocumentRenderer();
    expect(renderer.name).toBe("fake-test-renderer");
    expect((await renderer.render({} as never)).toString()).toBe("PDF");
  });
});
