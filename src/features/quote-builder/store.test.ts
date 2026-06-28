import { describe, expect, it } from "vitest";

import { builderReducer, emptyLine, initialBuilderState, type BuilderState } from "@/features/quote-builder/store";

function emptyState(): BuilderState {
  return { ...initialBuilderState(), lines: [] };
}

/**
 * Quote Builder reducer tests (Phase 5, §17, §40). Add / remove / reorder line
 * items — the pure state transitions behind the builder UI.
 */
function stateWithLines(): BuilderState {
  return {
    ...initialBuilderState(),
    lines: [
      { key: "a", serviceId: null, description: "A", quantity: "1", unitPrice: "10", taxRateId: null },
      { key: "b", serviceId: null, description: "B", quantity: "1", unitPrice: "20", taxRateId: null },
      { key: "c", serviceId: null, description: "C", quantity: "1", unitPrice: "30", taxRateId: null },
    ],
  };
}

describe("builderReducer", () => {
  it("defaults to one empty line when constructed blank", () => {
    expect(initialBuilderState().lines).toHaveLength(1);
  });

  it("adds a custom line", () => {
    const next = builderReducer(emptyState(), { type: "addCustomLine" });
    expect(next.lines).toHaveLength(1);
  });

  it("adds a catalog line with the provided values", () => {
    const next = builderReducer(emptyState(), {
      type: "addCatalogLine",
      line: { serviceId: "s1", description: "Svc", quantity: "1", unitPrice: "99.00", taxRateId: "t1" },
    });
    expect(next.lines[0]).toMatchObject({ serviceId: "s1", unitPrice: "99.00", taxRateId: "t1" });
  });

  it("exposes an emptyLine factory with sane defaults", () => {
    expect(emptyLine()).toMatchObject({ serviceId: null, quantity: "1" });
  });

  it("updates a line", () => {
    const next = builderReducer(stateWithLines(), {
      type: "updateLine",
      key: "b",
      patch: { quantity: "5" },
    });
    expect(next.lines.find((l) => l.key === "b")?.quantity).toBe("5");
  });

  it("removes a line", () => {
    const next = builderReducer(stateWithLines(), { type: "removeLine", key: "b" });
    expect(next.lines.map((l) => l.key)).toEqual(["a", "c"]);
  });

  it("moves a line up and down", () => {
    const down = builderReducer(stateWithLines(), { type: "moveLine", key: "a", direction: "down" });
    expect(down.lines.map((l) => l.key)).toEqual(["b", "a", "c"]);
    const up = builderReducer(stateWithLines(), { type: "moveLine", key: "c", direction: "up" });
    expect(up.lines.map((l) => l.key)).toEqual(["a", "c", "b"]);
  });

  it("ignores a move past the edges", () => {
    const noop = builderReducer(stateWithLines(), { type: "moveLine", key: "a", direction: "up" });
    expect(noop.lines.map((l) => l.key)).toEqual(["a", "b", "c"]);
  });

  it("sets a top-level field", () => {
    const next = builderReducer(initialBuilderState(), { type: "setField", field: "customerId", value: "cust-1" });
    expect(next.customerId).toBe("cust-1");
  });
});
