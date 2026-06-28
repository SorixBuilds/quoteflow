import "server-only";

import type { QuoteStatus } from "@prisma/client";

import { db } from "@/lib/db";
import { moneyToString } from "@/lib/money";
import { verifyQuoteShareToken } from "@/lib/tokens";

/**
 * Public quote view data (Phase 5, §16, §35 gap #2, §39). Read access is granted
 * solely by a valid HMAC token — there is no session here. The token authorizes
 * exactly one quote id; every field returned is scoped to that id and never
 * enumerable to any other record. No internal/financial-owner data is exposed.
 */

export type PublicQuote = {
  id: string;
  quoteNumber: string;
  status: QuoteStatus;
  version: number;
  companyName: string;
  companyLogoUrl: string | null;
  customerName: string;
  currency: string;
  subtotal: string;
  taxAmount: string;
  total: string;
  discountType: "PERCENT" | "FIXED" | null;
  discountValue: string | null;
  issueDate: Date | null;
  expiryDate: Date | null;
  notes: string | null;
  terms: string | null;
  items: {
    description: string;
    quantity: string;
    unitPrice: string;
    lineTotal: string;
  }[];
};

export async function getPublicQuoteByToken(token: string): Promise<PublicQuote | null> {
  const quoteId = verifyQuoteShareToken(token);
  if (!quoteId) return null;

  const quote = await db.quote.findUnique({
    where: { id: quoteId },
    select: {
      id: true,
      quoteNumber: true,
      status: true,
      version: true,
      currency: true,
      subtotal: true,
      taxAmount: true,
      total: true,
      discountType: true,
      discountValue: true,
      issueDate: true,
      expiryDate: true,
      notes: true,
      terms: true,
      customer: { select: { name: true } },
      organization: { select: { name: true, logoUrl: true } },
      items: {
        orderBy: { sortOrder: "asc" },
        select: { description: true, quantity: true, unitPrice: true, lineTotal: true },
      },
    },
  });
  if (!quote) return null;

  // A draft has never been sent — its link must not resolve.
  if (quote.status === "DRAFT") return null;

  return {
    id: quote.id,
    quoteNumber: quote.quoteNumber,
    status: quote.status,
    version: quote.version,
    companyName: quote.organization.name,
    companyLogoUrl: quote.organization.logoUrl,
    customerName: quote.customer.name,
    currency: quote.currency,
    subtotal: moneyToString(quote.subtotal),
    taxAmount: moneyToString(quote.taxAmount),
    total: moneyToString(quote.total),
    discountType: quote.discountType,
    discountValue: quote.discountValue ? moneyToString(quote.discountValue) : null,
    issueDate: quote.issueDate,
    expiryDate: quote.expiryDate,
    notes: quote.notes,
    terms: quote.terms,
    items: quote.items.map((it) => ({
      description: it.description,
      quantity: moneyToString(it.quantity),
      unitPrice: moneyToString(it.unitPrice),
      lineTotal: moneyToString(it.lineTotal),
    })),
  };
}
