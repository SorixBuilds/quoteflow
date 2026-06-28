import type { BuilderCatalog } from "@/features/catalog/cache";

/**
 * Quote Builder client state model (Phase 5, §17). Implemented with a pure
 * reducer (React `useReducer`) rather than a new state library — the builder is
 * local, ephemeral composition state that lives only until save, so it needs no
 * global store. The reducer is pure and unit-testable; the live total is derived
 * by `calculateQuoteTotal` (the same engine the server uses), never stored.
 */

export type BuilderLine = {
  /** Temporary client id, not persisted. */
  key: string;
  serviceId: string | null;
  description: string;
  quantity: string;
  unitPrice: string;
  taxRateId: string | null;
};

export type BuilderState = {
  customerId: string;
  lines: BuilderLine[];
  discountType: "" | "PERCENT" | "FIXED";
  discountValue: string;
  notes: string;
  terms: string;
  issueDate: string;
  expiryDate: string;
};

export type BuilderAction =
  | { type: "setField"; field: keyof BuilderState; value: string }
  | { type: "addCustomLine" }
  | { type: "addCatalogLine"; line: Omit<BuilderLine, "key"> }
  | { type: "updateLine"; key: string; patch: Partial<Omit<BuilderLine, "key">> }
  | { type: "removeLine"; key: string }
  | { type: "moveLine"; key: string; direction: "up" | "down" };

let counter = 0;
export function newLineKey(): string {
  counter += 1;
  return `line-${counter}-${Math.random().toString(36).slice(2, 8)}`;
}

export function emptyLine(): BuilderLine {
  return { key: newLineKey(), serviceId: null, description: "", quantity: "1", unitPrice: "0.00", taxRateId: null };
}

export function builderReducer(state: BuilderState, action: BuilderAction): BuilderState {
  switch (action.type) {
    case "setField":
      return { ...state, [action.field]: action.value };
    case "addCustomLine":
      return { ...state, lines: [...state.lines, emptyLine()] };
    case "addCatalogLine":
      return { ...state, lines: [...state.lines, { ...action.line, key: newLineKey() }] };
    case "updateLine":
      return {
        ...state,
        lines: state.lines.map((l) => (l.key === action.key ? { ...l, ...action.patch } : l)),
      };
    case "removeLine":
      return { ...state, lines: state.lines.filter((l) => l.key !== action.key) };
    case "moveLine": {
      const index = state.lines.findIndex((l) => l.key === action.key);
      if (index < 0) return state;
      const target = action.direction === "up" ? index - 1 : index + 1;
      if (target < 0 || target >= state.lines.length) return state;
      const lines = [...state.lines];
      [lines[index], lines[target]] = [lines[target], lines[index]];
      return { ...state, lines };
    }
    default:
      return state;
  }
}

/** Build the initial reducer state from a draft quote being edited, or blank. */
export function initialBuilderState(initial?: Partial<BuilderState> & { lines?: BuilderLine[] }): BuilderState {
  return {
    customerId: initial?.customerId ?? "",
    lines: initial?.lines && initial.lines.length > 0 ? initial.lines : [emptyLine()],
    discountType: initial?.discountType ?? "",
    discountValue: initial?.discountValue ?? "",
    notes: initial?.notes ?? "",
    terms: initial?.terms ?? "",
    issueDate: initial?.issueDate ?? "",
    expiryDate: initial?.expiryDate ?? "",
  };
}

/** Resolve a line's effective tax-rate percent for the live preview (§17). */
export function resolveLinePercent(
  catalog: BuilderCatalog,
  taxRateId: string | null,
): string | null {
  if (taxRateId) {
    return catalog.taxRates.find((t) => t.id === taxRateId)?.rate ?? null;
  }
  return catalog.taxRates.find((t) => t.isDefault)?.rate ?? null;
}
