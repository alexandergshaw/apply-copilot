import Link from "next/link";

import { AutoApplyNowButton } from "@/components/jobs/AutoApplyNowButton";
import { DeleteJobButton } from "@/components/jobs/DeleteJobButton";
import { TailorResumeButton } from "@/components/jobs/TailorResumeButton";
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
        {job.sourceType ? <span className="capitalize">Type: {job.sourceType}</span> : null}
        <span>Match: {job.matchScore}%</span>
      </div>
      <p className="mt-4 text-sm text-slate-700">{job.description}</p>
      <div className="mt-4 flex flex-wrap gap-3">
        <Link
          className="inline-flex rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
          href={`/jobs/${job.id}`}
        >
          View details
        </Link>
        <TailorResumeButton jobId={job.id} />
        <AutoApplyNowButton jobId={job.id} jobRole={job.role} company={job.company} />
        <Link
          className="inline-flex rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
          href={`/jobs/${job.id}#tailor-resume`}
        >
          Open tailoring
        </Link>
        {job.applyUrl ? (
          <a
            className="inline-flex rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
            href={job.applyUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            View Posting
          </a>
        ) : null}
        <DeleteJobButton jobId={job.id} jobRole={job.role} company={job.company} />
      </div>
    </article>
  );
}
