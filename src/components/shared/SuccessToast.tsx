import { toast } from "sonner";

/**
 * Shared success/error toast helpers (Phase 4, §9). Thin wrappers over sonner
 * (already mounted in `AppProviders`) so every screen raises a consistent,
 * ephemeral confirmation rather than hand-rolling its own. Time-sensitive or
 * actionable messages belong in the Notification center instead (§9, §15).
 */
export function showSuccessToast(message: string, description?: string): void {
  toast.success(message, description ? { description } : undefined);
}

export function showErrorToast(message: string, description?: string): void {
  toast.error(message, description ? { description } : undefined);
}
