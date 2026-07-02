import { requireApiKey } from "@/lib/api/auth";
import { apiHandler } from "@/lib/api/error";
import { itemResponse, notFound, requireUuid } from "@/lib/api/params";
import { serializeInvoice, serializePayment } from "@/lib/api/serializers";
import { db } from "@/lib/db";

/**
 * `GET /api/v1/invoices/[id]` (§21.6) — one invoice with its recorded
 * payments, only if it belongs to the key's organization. One relation level
 * (§23). Payment reads ride the `invoices:read` scope: a payment is a fact
 * about an invoice's settlement, exposed only through its invoice (§21.8's
 * closed scope list has no separate payments scope).
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = apiHandler<{ id: string }>(async (req, context) => {
  const { organizationId } = await requireApiKey(req, "invoices:read");
  const { id } = await context.params;
  requireUuid(id);

  const invoice = await db.invoice.findFirst({
    where: { id, organizationId },
    include: { payments: { orderBy: { paidAt: "asc" } } },
  });
  if (!invoice) throw notFound();

  const { payments, ...row } = invoice;
  return itemResponse({
    ...serializeInvoice(row),
    payments: payments.map(serializePayment),
  });
});
