import { requireApiKey } from "@/lib/api/auth";
import { apiHandler } from "@/lib/api/error";
import { itemResponse, notFound, requireUuid } from "@/lib/api/params";
import { serializeQuote, serializeQuoteItem } from "@/lib/api/serializers";
import { db } from "@/lib/db";

/**
 * `GET /api/v1/quotes/[id]` (§21.6) — one quote with its line items, only if
 * it belongs to the key's organization. One relation level (§23).
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = apiHandler<{ id: string }>(async (req, context) => {
  const { organizationId } = await requireApiKey(req, "quotes:read");
  const { id } = await context.params;
  requireUuid(id);

  const quote = await db.quote.findFirst({
    where: { id, organizationId },
    include: { items: { orderBy: { sortOrder: "asc" } } },
  });
  if (!quote) throw notFound();

  const { items, ...row } = quote;
  return itemResponse({ ...serializeQuote(row), items: items.map(serializeQuoteItem) });
});
