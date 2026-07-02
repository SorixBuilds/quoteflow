"use server";

import { revalidatePath } from "next/cache";
import { unstable_rethrow } from "next/navigation";

import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { requireActiveUser, requireCompanyScope, requireRole } from "@/lib/permissions";
import { BusinessRuleError, toActionError } from "@/lib/errors";
import { logActivity } from "@/features/activity/actions";
import { notifyPortalInvitation } from "@/features/email/dispatch";
import {
  issuePortalToken as issuePortalTokenRecord,
  revokePortalToken as revokePortalTokenRecord,
  getPortalTokenById,
} from "@/features/customer-portal/repository";
import { issuePortalTokenFormSchema } from "@/features/customer-portal/validation";
import type { IssuePortalTokenFormInput } from "@/features/customer-portal/validation";
import type { ActionResult } from "@/types";

/**
 * STAFF-facing portal-token actions (§12.6). These run under the **staff**
 * session, are invoked from the internal Customer detail page, and are the *only*
 * place in the customer-portal feature that touches `requireRole` — deliberately
 * kept in their own module, separate from `actions.ts` (the customer-session
 * surface), so the import-boundary guarantee (§12.12, §25) that the portal-session
 * actions never import a staff auth helper is mechanical and CI-verifiable.
 *
 * A token's plaintext is shown exactly once, here, in the returned link; only its
 * bcrypt hash is ever stored (§12.9). Staff copies the link and delivers it
 * out-of-band (text/email) until Email is funded (§12.7, §12.13).
 */

export type IssuedPortalLink = {
  /** The full one-time `/portal/login?token=...` URL — surfaced once, never recoverable. */
  url: string;
  label: string | null;
  expiresAt: Date;
};

export async function issuePortalToken(
  input: IssuePortalTokenFormInput,
): Promise<ActionResult<IssuedPortalLink>> {
  try {
    const session = await requireRole(["OWNER", "STAFF"]);
    await requireActiveUser();
    const { organizationId } = await requireCompanyScope(session);

    const { customerId, label, expiresInDays } = issuePortalTokenFormSchema.parse(input);

    // The customer must exist in the staff member's own organization.
    const customer = await db.customer.findFirst({
      where: { id: customerId, organizationId },
      select: { id: true, name: true, email: true },
    });
    if (!customer) throw new BusinessRuleError("Customer not found.");

    const expiresAt = new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000);
    const normalizedLabel = label && label.length > 0 ? label : undefined;

    const { plaintext } = await issuePortalTokenRecord(organizationId, session.id, {
      customerId,
      label: normalizedLabel,
      expiresAt,
    });

    // `plaintext` is base64url — URL-safe, embedded without further encoding.
    const url = `${env.NEXT_PUBLIC_APP_URL}/portal/login?token=${plaintext}`;

    await logActivity({
      organizationId,
      entityType: "CUSTOMER",
      entityId: customerId,
      type: "portal_token_issued",
      message: normalizedLabel,
      createdById: session.id,
    });

    // Auto-deliver the invitation by email when the customer has an address on
    // file (§4 — replace manual token sharing). Non-fatal: the link is still
    // returned so staff can copy it if email is simulated/undeliverable.
    if (customer.email) {
      await notifyPortalInvitation(organizationId, {
        customerId,
        customerName: customer.name,
        to: customer.email,
        portalUrl: url,
        expiresAt,
      });
    }

    revalidatePath(`/customers/${customerId}`);

    return {
      success: true,
      data: {
        url,
        label: normalizedLabel ?? null,
        expiresAt,
      },
    };
  } catch (error) {
    unstable_rethrow(error);
    return toActionError(error);
  }
}

export async function revokePortalToken(tokenId: string): Promise<ActionResult<null>> {
  try {
    const session = await requireRole(["OWNER", "STAFF"]);
    const { organizationId } = await requireCompanyScope(session);

    const token = await getPortalTokenById(organizationId, tokenId);
    if (!token) throw new BusinessRuleError("Link not found.");

    await revokePortalTokenRecord(organizationId, tokenId);

    await logActivity({
      organizationId,
      entityType: "CUSTOMER",
      entityId: token.customerId,
      type: "portal_token_revoked",
      createdById: session.id,
    });

    revalidatePath(`/customers/${token.customerId}`);
    return { success: true, data: null };
  } catch (error) {
    unstable_rethrow(error);
    return toActionError(error);
  }
}
