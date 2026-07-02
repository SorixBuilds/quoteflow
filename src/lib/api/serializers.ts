import type {
  Customer,
  Invoice,
  Job,
  Lead,
  Payment,
  Prisma,
  Quote,
  QuoteItem,
} from "@prisma/client";

import { subtractFloorZero } from "@/lib/money";

/**
 * Public API response serializers (§21.6, §21.14). Each is an explicit,
 * whitelisted field map — never a spread of the Prisma row — so the wire
 * contract is a deliberate artifact: adding a field is additive (allowed under
 * the v1 freeze), while nothing internal (hashes, foreign tenants' relations,
 * server-only columns) can leak by accident.
 *
 * Two representation rules, applied uniformly:
 *  - Money/quantity (`Decimal`) → fixed-2 decimal **strings** ("1250.00"), the
 *    same "never a JS float" discipline the internal pipeline follows (§5);
 *    callers parse with their own decimal type, exactly as they would from any
 *    invoicing API.
 *  - Dates → ISO-8601 strings or null.
 */

const money = (value: Prisma.Decimal): string => value.toFixed(2);
const moneyOrNull = (value: Prisma.Decimal | null): string | null =>
  value === null ? null : value.toFixed(2);
const iso = (value: Date): string => value.toISOString();
const isoOrNull = (value: Date | null): string | null =>
  value === null ? null : value.toISOString();

export function serializeLead(lead: Lead) {
  return {
    id: lead.id,
    name: lead.name,
    email: lead.email,
    phone: lead.phone,
    status: lead.status,
    lostReason: lead.lostReason,
    sourceId: lead.sourceId,
    assignedToId: lead.assignedToId,
    customerId: lead.customerId,
    createdAt: iso(lead.createdAt),
    updatedAt: iso(lead.updatedAt),
  };
}

export function serializeCustomer(customer: Customer) {
  return {
    id: customer.id,
    name: customer.name,
    type: customer.type,
    email: customer.email,
    phone: customer.phone,
    address: customer.address,
    createdAt: iso(customer.createdAt),
    updatedAt: iso(customer.updatedAt),
  };
}

export function serializeQuote(quote: Quote) {
  return {
    id: quote.id,
    quoteNumber: quote.quoteNumber,
    status: quote.status,
    version: quote.version,
    parentQuoteId: quote.parentQuoteId,
    customerId: quote.customerId,
    leadId: quote.leadId,
    discountType: quote.discountType,
    discountValue: moneyOrNull(quote.discountValue),
    subtotal: money(quote.subtotal),
    taxAmount: money(quote.taxAmount),
    total: money(quote.total),
    currency: quote.currency,
    issueDate: isoOrNull(quote.issueDate),
    expiryDate: isoOrNull(quote.expiryDate),
    sentAt: isoOrNull(quote.sentAt),
    viewedAt: isoOrNull(quote.viewedAt),
    acceptedAt: isoOrNull(quote.acceptedAt),
    declinedAt: isoOrNull(quote.declinedAt),
    createdAt: iso(quote.createdAt),
    updatedAt: iso(quote.updatedAt),
  };
}

export function serializeQuoteItem(item: QuoteItem) {
  return {
    id: item.id,
    description: item.description,
    quantity: money(item.quantity),
    unitPrice: money(item.unitPrice),
    lineTotal: money(item.lineTotal),
    serviceId: item.serviceId,
    taxRateId: item.taxRateId,
    sortOrder: item.sortOrder,
  };
}

export function serializeJob(job: Job) {
  return {
    id: job.id,
    quoteId: job.quoteId,
    customerId: job.customerId,
    assignedToId: job.assignedToId,
    status: job.status,
    scheduledDate: isoOrNull(job.scheduledDate),
    scheduledEndAt: isoOrNull(job.scheduledEndAt),
    completedAt: isoOrNull(job.completedAt),
    notes: job.notes,
    createdAt: iso(job.createdAt),
    updatedAt: iso(job.updatedAt),
  };
}

export function serializeInvoice(invoice: Invoice) {
  return {
    id: invoice.id,
    invoiceNumber: invoice.invoiceNumber,
    jobId: invoice.jobId,
    customerId: invoice.customerId,
    amount: money(invoice.amount),
    paidAmount: money(invoice.paidAmount),
    // Derived, floored at zero via the shared money helper (§5) — the same
    // balance rule the internal app and the automation snapshot already use.
    balance: money(subtractFloorZero(invoice.amount, invoice.paidAmount)),
    status: invoice.status,
    dueDate: isoOrNull(invoice.dueDate),
    issuedAt: isoOrNull(invoice.issuedAt),
    createdAt: iso(invoice.createdAt),
    updatedAt: iso(invoice.updatedAt),
  };
}

export function serializePayment(payment: Payment) {
  return {
    id: payment.id,
    invoiceId: payment.invoiceId,
    amount: money(payment.amount),
    method: payment.method,
    reference: payment.reference,
    paidAt: iso(payment.paidAt),
  };
}
