"use client";

import { useState, useTransition } from "react";

import { approveAutoApply, cancelAutoApply } from "@/app/jobs/[id]/actions";
import type { ActionResult } from "@/lib/actions";

type AutoApplyControlsProps = {
  jobId: string;
  autoApplyEnabled: boolean;
};

export function AutoApplyControls({ jobId, autoApplyEnabled }: AutoApplyControlsProps) {
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  const run = (action: () => Promise<ActionResult>) => {
    setMessage(null);
    startTransition(async () => {
      const result = await action();
      if (!result.ok) {
        setMessage(result.message ?? "Unable to update auto-apply state.");
      }
    });
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <button
          className="rounded-md border border-emerald-300 bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-800 disabled:opacity-60"
          type="button"
          disabled={isPending || autoApplyEnabled}
          onClick={() => run(() => approveAutoApply(jobId))}
        >
          {isPending ? "Updating..." : "Approve Auto Apply"}
        </button>
        <button
          className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 disabled:opacity-60"
          type="button"
          disabled={isPending}
          onClick={() => run(() => cancelAutoApply(jobId))}
        >
          Cancel Auto Apply
        </button>
      </div>
      {message ? <p className="text-sm text-amber-700">{message}</p> : null}
    </div>
  );
}
