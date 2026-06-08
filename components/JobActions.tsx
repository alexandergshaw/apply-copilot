"use client";

import { useState, useTransition } from "react";

import {
  createApplicationPacketPlaceholder,
  markJobApplied,
  rejectJob,
  saveJobForLater,
  type ActionResult,
} from "@/lib/actions";

type JobActionsProps = {
  jobId: string;
};

export function JobActions({ jobId }: JobActionsProps) {
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  const run = (action: () => Promise<ActionResult>) => {
    setMessage(null);
    startTransition(async () => {
      const result = await action();
      if (!result.ok && result.message) {
        setMessage(result.message);
      }
    });
  };

  return (
    <div className="mt-4 space-y-2">
      <div className="flex flex-wrap gap-2">
        <button
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-60"
          type="button"
          disabled={isPending}
          onClick={() => run(() => createApplicationPacketPlaceholder(jobId))}
        >
          Generate Packet
        </button>
        <button
          className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 disabled:opacity-60"
          type="button"
          disabled={isPending}
          onClick={() => run(() => saveJobForLater(jobId))}
        >
          Save
        </button>
        <button
          className="rounded-md border border-red-200 px-4 py-2 text-sm font-medium text-red-700 disabled:opacity-60"
          type="button"
          disabled={isPending}
          onClick={() => run(() => rejectJob(jobId))}
        >
          Reject
        </button>
        <button
          className="rounded-md border border-blue-200 px-4 py-2 text-sm font-medium text-blue-700 disabled:opacity-60"
          type="button"
          disabled={isPending}
          onClick={() => run(() => markJobApplied(jobId))}
        >
          Mark Applied
        </button>
      </div>
      {message ? <p className="text-sm text-amber-700">{message}</p> : null}
    </div>
  );
}
