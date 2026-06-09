"use client";

import { useState, useTransition } from "react";

import { autoApplyNow } from "@/app/jobs/[id]/actions";

type AutoApplyNowButtonProps = {
  jobId: string;
  jobRole: string;
  company: string;
};

export function AutoApplyNowButton({ jobId, jobRole, company }: AutoApplyNowButtonProps) {
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  const onClick = () => {
    const confirmed = window.confirm(
      `Start auto-apply for ${jobRole} at ${company}? This will tailor your resume and generate an application packet.`,
    );
    if (!confirmed) {
      return;
    }

    setMessage(null);
    startTransition(async () => {
      const result = await autoApplyNow(jobId);
      if (!result.ok) {
        setMessage(result.message ?? "Auto-apply failed.");
        return;
      }

      setMessage(result.message ?? "Auto-apply completed.");
    });
  };

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        disabled={isPending}
        onClick={onClick}
        className="inline-flex rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-800 hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isPending ? "Auto applying..." : "Auto Apply"}
      </button>
      {message ? <p className="text-xs text-slate-600">{message}</p> : null}
    </div>
  );
}
