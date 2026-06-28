"use server";

import { revalidatePath } from "next/cache";
import { unstable_rethrow } from "next/navigation";
import { Prisma } from "@prisma/client";

import { db } from "@/lib/db";
import { requireActiveUser, requireCompanyScope, requireRole } from "@/lib/permissions";
import { getNextInvoiceNumber } from "@/lib/numbering";
import { toDecimal } from "@/lib/money";
import { deriveInvoiceStatus } from "@/lib/status";
import { logActivity } from "@/features/activity/actions";
import { createInvoiceSchema, recordPaymentSchema, type CreateInvoiceInput, type RecordPaymentInput } from "@/features/invoices/schema";
import { BusinessRuleError, toActionError } from "@/lib/errors";
import type { ActionResult } from "@/types";

/**
 * Invoice & Payment write path (Phase 5, §21). An invoice is created against a
 * Job (deposit/progress/final — `jobId` is intentionally non-unique). Its status
 * is NEVER set directly: `recordPayment` is the only writer of `paidAmount`/
 * `status`, deriving status from the live Payment sum, inside a Serializable
 * transaction so two concurrent payments can never lose an update (§39).
 */

export async function createInvoice(
  input: CreateInvoiceInput,
): Promise<ActionResult<{ id: string }>> {
  try {
    const session = await requireRole(["OWNER", "STAFF"]);
    await requireActiveUser();
    const { organizationId } = await requireCompanyScope(session);
    const data = createInvoiceSchema.parse(input);

    const job = await db.job.findFirst({
      where: { id: data.jobId, organizationId },
      select: { id: true, customerId: true },
    });
    if (!job) throw new BusinessRuleError("That job could not be found.");

    const invoiceNumber = await getNextInvoiceNumber(organizationId);
    const invoice = await db.invoice.create({
      data: {
        organizationId,
        jobId: job.id,
        customerId: job.customerId,
        invoiceNumber,
        amount: toDecimal(data.amount),
        paidAmount: toDecimal("0"),
        status: "UNPAID",
        issuedAt: new Date(),
        dueDate: data.dueDate ? new Date(data.dueDate) : null,
      },
      select: { id: true },
    });

    await logActivity({
      organizationId,
      entityType: "INVOICE",
      entityId: invoice.id,
      type: "invoice_created",
      message: `Invoice ${invoiceNumber}`,
      createdById: session.id,
    });

    revalidatePath(`/jobs/${job.id}`);
    revalidatePath("/invoices");
    return { success: true, data: { id: invoice.id } };
  } catch (error) {
    unstable_rethrow(error);
    return toActionError(error);
  }
}

export async function recordPayment(
  input: RecordPaymentInput,
): Promise<ActionResult<{ status: string }>> {
  try {
    const session = await requireRole(["OWNER", "STAFF"]);
    await requireActiveUser();
    const { organizationId } = await requireCompanyScope(session);
    const data = recordPaymentSchema.parse(input);

    const result = await db.$transaction(
      async (tx) => {
        const invoice = await tx.invoice.findFirst({
          where: { id: data.invoiceId, organizationId },
          select: { id: true, amount: true, jobId: true },
        });
        if (!invoice) return null;

        await tx.payment.create({
          data: {
            organizationId,
            invoiceId: invoice.id,
            amount: toDecimal(data.amount),
            method: data.method,
            reference: data.reference ? data.reference : null,
            paidAt: data.paidAt ? new Date(data.paidAt) : new Date(),
          },
        });

        // Recompute paidAmount from the authoritative sum of all payments (§21).
        const agg = await tx.payment.aggregate({
          where: { invoiceId: invoice.id },
          _sum: { amount: true },
        });
        const paidAmount = agg._sum.amount ?? new Prisma.Decimal(0);
        const status = deriveInvoiceStatus(invoice.amount, paidAmount);

        await tx.invoice.update({
          where: { id: invoice.id },
          data: { paidAmount, status },
        });

        return { status, jobId: invoice.jobId };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    if (!result) return { success: false, error: "Invoice not found." };

    await logActivity({
      organizationId,
      entityType: "INVOICE",
      entityId: data.invoiceId,
      type: "payment_recorded",
      message: `${data.method} payment recorded`,
      createdById: session.id,
    });

    // Notify the deal owner (the quote's assignee) — LOW priority (§25).
    const owner = await db.job.findFirst({
      where: { id: result.jobId, organizationId },
      select: { quote: { select: { assignedToId: true } } },
    });
    if (owner?.quote.assignedToId) {
      await db.notification.create({
        data: {
          organizationId,
          userId: owner.quote.assignedToId,
          type: "payment_recorded",
          title: "Payment recorded",
          priority: "LOW",
          entityType: "INVOICE",
          entityId: data.invoiceId,
          actionUrl: `/invoices/${data.invoiceId}`,
          actionLabel: "View invoice",
        },
      });
    }

    revalidatePath(`/invoices/${data.invoiceId}`);
    revalidatePath("/invoices");
    return { success: true, data: { status: result.status } };
  } catch (error) {
    unstable_rethrow(error);
    return toActionError(error);
  }
}
