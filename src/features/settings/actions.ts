"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { unstable_rethrow } from "next/navigation";
import { z } from "zod";

import { db } from "@/lib/db";
import { requireRole } from "@/lib/permissions";
import { companyConfigTag } from "@/lib/config/cache";
import { updateCompanyConfig } from "@/lib/config/service";
import { fileUrlSchema } from "@/features/files/types";
import type { CompanyConfig, CompanyConfigPatch } from "@/lib/config/schema";
import type { ActionResult } from "@/types";

/**
 * Settings server actions (Phase 4, §11). Thin wrappers around the Configuration
 * Service — they never touch `Organization.settings` directly. Each is OWNER-
 * gated (and the service re-checks OWNER internally, §5.5). Validation failures
 * surface as a typed `ActionResult` error rather than an exception.
 */

const organizationNameSchema = z
  .string()
  .trim()
  .min(1, "Organization name is required.")
  .max(120, "Organization name is too long.");

function toErrorMessage(error: unknown): string {
  if (error instanceof z.ZodError) {
    return error.issues[0]?.message ?? "Please check the highlighted fields.";
  }
  if (error instanceof Error && error.message) return error.message;
  return "Something went wrong. Please try again.";
}

/** Persist a section-aware partial update to the tenant's configuration. */
export async function saveCompanyConfigAction(
  partial: CompanyConfigPatch,
): Promise<ActionResult<CompanyConfig>> {
  try {
    const session = await requireRole(["OWNER"]);
    const updated = await updateCompanyConfig(session.organizationId, partial);
    // Invalidate the tenant's config Data Cache, then the rendered routes that
    // derive content from it (§21 invalidation map).
    revalidateTag(companyConfigTag(session.organizationId), { expire: 0 });
    revalidatePath("/settings", "layout");
    return { success: true, data: updated };
  } catch (error) {
    unstable_rethrow(error);
    return { success: false, error: toErrorMessage(error) };
  }
}

/**
 * Update the organization's profile columns (name + logo URL) — Phase 2 columns,
 * not config JSON. The logo URL uses the FileRef V1 url-paste contract (§16).
 */
export async function saveOrganizationProfileAction(input: {
  name: string;
  logoUrl: string;
}): Promise<ActionResult<{ name: string; logoUrl: string }>> {
  try {
    const session = await requireRole(["OWNER"]);
    const name = organizationNameSchema.parse(input.name);
    const logoUrl = fileUrlSchema.parse(input.logoUrl);
    await db.organization.update({
      where: { id: session.organizationId },
      data: { name, logoUrl: logoUrl === "" ? null : logoUrl },
    });
    revalidatePath("/settings", "layout");
    return { success: true, data: { name, logoUrl } };
  } catch (error) {
    unstable_rethrow(error);
    return { success: false, error: toErrorMessage(error) };
  }
}
