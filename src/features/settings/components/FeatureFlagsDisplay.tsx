import type { FeatureFlags } from "@/lib/config/schema";
import { cn } from "@/lib/utils";

/**
 * Read-only feature flags display (Phase 4, §8, §20). Toggle UI is intentionally
 * not built here — a flag's toggle is added only once the feature it gates
 * exists. In V1 this proves the flags exist and surfaces their current state.
 */
const FLAG_LABELS: Record<keyof FeatureFlags, string> = {
  ai: "AI features",
  portal: "Customer portal",
  automation: "Automations & follow-ups",
  advancedReports: "Advanced reports",
  invoicing: "Invoicing",
  integrations: "Third-party integrations",
};

export function FeatureFlagsDisplay({
  featureFlags,
}: {
  featureFlags: FeatureFlags;
}) {
  const entries = Object.keys(FLAG_LABELS) as (keyof FeatureFlags)[];

  return (
    <ul className="divide-y">
      {entries.map((key) => {
        const enabled = featureFlags[key];
        return (
          <li key={key} className="flex items-center justify-between py-3">
            <span className="text-sm">{FLAG_LABELS[key]}</span>
            <span
              className={cn(
                "rounded-full px-2.5 py-0.5 text-xs font-medium",
                enabled
                  ? "bg-success/15 text-success"
                  : "bg-muted text-muted-foreground",
              )}
            >
              {enabled ? "Enabled" : "Disabled"}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
