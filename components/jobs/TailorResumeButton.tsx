"use client";

import { useState, useTransition } from "react";

import { tailorResumeForDownload } from "@/app/jobs/[id]/actions";

type TailorResumeButtonProps = {
  jobId: string;
};

export function TailorResumeButton({ jobId }: TailorResumeButtonProps) {
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  const onClick = () => {
    setMessage(null);
    startTransition(async () => {
      const result = await tailorResumeForDownload(jobId);
      if (!result.ok || !result.tailoredResumeId || !result.jobId) {
        setMessage(result.message ?? "Unable to tailor and download resume.");
        return;
      }

      setMessage(result.message ?? "Tailored resume generated. Downloading...");
      window.location.href = `/jobs/${result.jobId}/tailored-resumes/${result.tailoredResumeId}/download`;
    });
  };

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        disabled={isPending}
        onClick={onClick}
        className="inline-flex rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isPending ? "Tailoring..." : "Tailor Resume"}
      </button>
      {message ? <p className="text-xs text-slate-600">{message}</p> : null}
    </div>
  );
}
