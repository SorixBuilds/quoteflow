import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

// QuoteDecisionButtons / PortalNav import the portal actions, which transitively
// pull in the `server-only` session module — mock the action surface so these
// stay pure render tests.
vi.mock("@/features/customer-portal/actions", () => ({
  acceptQuoteFromPortal: vi.fn(),
  declineQuoteFromPortal: vi.fn(),
  logoutPortal: vi.fn(),
}));
vi.mock("next/navigation", () => ({ usePathname: () => "/portal/quotes" }));

import { PortalQuoteView } from "@/features/customer-portal/components/PortalQuoteView";
import { PortalInvoiceView } from "@/features/customer-portal/components/PortalInvoiceView";
import { PortalNav } from "@/features/customer-portal/components/PortalNav";
import type { PortalInvoiceDetail, PortalQuoteDetail } from "@/features/customer-portal/queries";

function quote(overrides: Partial<PortalQuoteDetail> = {}): PortalQuoteDetail {
  return {
    id: "q1",
    quoteNumber: "Q-001",
    status: "SENT",
    total: "110.00",
    issueDate: new Date("2026-06-01T00:00:00Z"),
    expiryDate: null,
    currency: "USD",
    subtotal: "100.00",
    taxAmount: "10.00",
    discountType: null,
    discountValue: null,
    notes: null,
    terms: null,
    decidable: true,
    items: [{ description: "Work", quantity: "1", unitPrice: "100.00", lineTotal: "100.00" }],
    ...overrides,
  };
}

describe("PortalQuoteView (§12.5)", () => {
  it("shows Accept/Decline while the quote is decidable", () => {
    render(<PortalQuoteView quote={quote({ decidable: true })} attachments={[]} />);
    expect(screen.getByRole("button", { name: /accept quote/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /decline/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /download pdf/i })).toBeInTheDocument();
  });

  it("hides Accept/Decline once the quote is decided", () => {
    render(<PortalQuoteView quote={quote({ status: "ACCEPTED", decidable: false })} attachments={[]} />);
    expect(screen.queryByRole("button", { name: /accept quote/i })).toBeNull();
    expect(screen.getByRole("link", { name: /download pdf/i })).toBeInTheDocument();
  });
});

describe("PortalInvoiceView (§12.5)", () => {
  function invoice(overrides: Partial<PortalInvoiceDetail> = {}): PortalInvoiceDetail {
    return {
      id: "inv1",
      invoiceNumber: "INV-001",
      status: "UNPAID",
      amount: "200.00",
      paidAmount: "0.00",
      balance: "200.00",
      dueDate: null,
      issuedAt: null,
      payments: [],
      ...overrides,
    };
  }

  it("shows an empty payment history and only the invoice download when unpaid", () => {
    render(<PortalInvoiceView invoice={invoice()} currency="USD" attachments={[]} />);
    expect(screen.getByText(/no payments recorded yet/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /download invoice/i })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /download receipt/i })).toBeNull();
  });

  it("offers a receipt download once a payment exists", () => {
    render(
      <PortalInvoiceView
        invoice={invoice({
          status: "PARTIAL",
          paidAmount: "50.00",
          balance: "150.00",
          payments: [{ amount: "50.00", method: "CASH", reference: null, paidAt: new Date() }],
        })}
        currency="USD"
        attachments={[]}
      />,
    );
    expect(screen.getByRole("link", { name: /download receipt/i })).toBeInTheDocument();
  });
});

describe("PortalNav (§12.5)", () => {
  it("exposes exactly the four customer destinations plus sign out", () => {
    render(<PortalNav organizationName="Acme Co" />);
    for (const label of ["Quotes", "Invoices", "Jobs", "Account"]) {
      expect(screen.getByRole("link", { name: label })).toBeInTheDocument();
    }
    expect(screen.getByRole("button", { name: /sign out/i })).toBeInTheDocument();
    // No internal-app destination is reachable from the portal nav.
    expect(screen.queryByRole("link", { name: /dashboard|settings|leads/i })).toBeNull();
  });
});
