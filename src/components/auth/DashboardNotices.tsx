"use client";

import { useEffect, useRef } from "react";
import { toast } from "sonner";

/**
 * Surfaces the approved insufficient-role redirect as a toast on the dashboard
 * (§11.3) — the deliberate alternative to a hard 403 page. The redirect carries
 * `?error=insufficient-role`; this fires the toast exactly once.
 */
export function DashboardNotices({ error }: { error?: string }) {
  const handled = useRef(false);

  useEffect(() => {
    if (handled.current) return;
    if (error === "insufficient-role") {
      toast.error("You don't have access to that page.");
      handled.current = true;
    }
  }, [error]);

  return null;
}
