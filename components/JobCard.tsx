import Link from "next/link";

import type { Job } from "@/lib/mock-data";
import { StatusBadge } from "@/components/StatusBadge";

type JobCardProps = {
  job: Job;
};

export function JobCard({ job }: JobCardProps) {
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">{job.role}</h3>
          <p className="text-sm text-slate-600">{job.company} · {job.location}</p>
        </div>
        <StatusBadge status={job.status} />
      </div>
      <div className="mt-4 flex flex-wrap gap-3 text-sm text-slate-600">
        <span>Source: {job.source}</span>
        <span>Match: {job.matchScore}%</span>
      </div>
      <p className="mt-4 text-sm text-slate-700">{job.description}</p>
      <Link
        className="mt-4 inline-flex rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
        href={`/jobs/${job.id}`}
      >
        View details
      </Link>
    </article>
  );
}
