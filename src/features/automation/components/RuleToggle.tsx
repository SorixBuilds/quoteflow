"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { Button } from "@/components/ui/button";
import { showSuccessToast } from "@/components/shared/SuccessToast";
import { toggleRule } from "@/features/automation/actions";

/**
 * Enable/disable control for a rule (§13, §15.8). OWNER-only server action; the
 * button reflects the current state and flips it. A disabled rule stays in the
 * list (and keeps its history) but stops firing.
 */
export function RuleToggle({ id, isActive }: { id: string; isActive: boolean }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleToggle() {
    startTransition(async () => {
      const result = await toggleRule(id, !isActive);
      if (result.success) {
        showSuccessToast(result.data.isActive ? "Rule enabled" : "Rule disabled");
        router.refresh();
      }
    });
  }

  return (
    <Button
      type="button"
      variant={isActive ? "outline" : "default"}
      size="sm"
      disabled={isPending}
      onClick={handleToggle}
    >
      {isActive ? "Disable" : "Enable"}
    </Button>
  );
}
