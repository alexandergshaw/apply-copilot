"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { deleteJob } from "@/lib/actions";

type DeleteJobButtonProps = {
  jobId: string;
  jobRole: string;
  company: string;
};

export function DeleteJobButton({ jobId, jobRole, company }: DeleteJobButtonProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  const confirmMessage = `Delete ${jobRole} at ${company}? This cannot be undone.`;

  const onDelete = () => {
    if (!window.confirm(confirmMessage)) {
      return;
    }

    setMessage(null);
    startTransition(async () => {
      const result = await deleteJob(jobId);
      if (!result.ok) {
        setMessage(result.message ?? "Unable to delete job.");
        return;
      }

      router.refresh();
    });
  };

  return (
    <div className="space-y-2">
      <button
        className="inline-flex rounded-lg border border-red-200 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-60"
        type="button"
        disabled={isPending}
        onClick={onDelete}
      >
        {isPending ? "Deleting..." : "Delete job"}
      </button>
      {message ? <p className="text-sm text-amber-700">{message}</p> : null}
    </div>
  );
}
