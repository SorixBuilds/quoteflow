"use client";

import { useTransition } from "react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { showErrorToast, showSuccessToast } from "@/components/shared/SuccessToast";
import {
  connectIntegration,
  disconnectIntegration,
} from "@/features/integrations/actions";

/**
 * One registered integration provider: name, connection status, and the
 * Connect/Disconnect control (§20.5, §20.7). With the Phase 6 registry empty
 * this component has no live instances yet — it is the complete, tested UI a
 * future adapter drops into by adding one registry entry.
 */

const STATUS_BADGE: Record<string, string> = {
  CONNECTED: "bg-green-100 text-green-700",
  ERROR: "bg-red-100 text-red-700",
  NOT_CONNECTED: "bg-slate-100 text-slate-700",
};

const STATUS_LABEL: Record<string, string> = {
  CONNECTED: "Connected",
  ERROR: "Connection failed",
  NOT_CONNECTED: "Not connected",
};

export function IntegrationCard({
  providerKey,
  displayName,
  status,
}: {
  providerKey: string;
  displayName: string;
  status: string;
}) {
  const [isPending, startTransition] = useTransition();
  const connected = status === "CONNECTED";

  function onToggleConnection() {
    startTransition(async () => {
      const result = connected
        ? await disconnectIntegration(providerKey)
        : await connectIntegration(providerKey, null);
      if (result.success) {
        showSuccessToast(connected ? `${displayName} disconnected.` : `${displayName} connected.`);
      } else {
        showErrorToast(result.error);
      }
    });
  }

  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border p-4">
      <div>
        <p className="text-foreground text-sm font-medium">{displayName}</p>
        <span
          className={cn(
            "mt-1 inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
            STATUS_BADGE[status] ?? STATUS_BADGE.NOT_CONNECTED,
          )}
        >
          {STATUS_LABEL[status] ?? status}
        </span>
      </div>
      <Button
        type="button"
        variant={connected ? "outline" : "default"}
        size="sm"
        disabled={isPending}
        onClick={onToggleConnection}
      >
        {isPending ? "Working…" : connected ? "Disconnect" : status === "ERROR" ? "Try again" : "Connect"}
      </Button>
    </div>
  );
}
