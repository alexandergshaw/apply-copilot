import { notFound } from "next/navigation";

import { JobActions } from "@/components/JobActions";
import { StatusBadge } from "@/components/StatusBadge";
import { AutoApplyControls } from "@/components/jobs/AutoApplyControls";
import type { AutoApplyRun } from "@/lib/mock-data";
import { getAutoApplyRuns, getJob } from "@/lib/queries";

type JobDetailsProps = {
  params: Promise<{ id: string }>;
};

export default async function JobDetailsPage({ params }: JobDetailsProps) {
  const { id } = await params;
  const [job, autoApplyRuns] = await Promise.all([getJob(id), getAutoApplyRuns(id)]);

  if (!job) {
    notFound();
  }

  const formatDateTime = (value: string) => {
    if (!value) {
      return "Not set";
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return value;
    }

    return date.toLocaleString();
  };

  const renderRunDate = (run: AutoApplyRun, field: "startedAt" | "finishedAt" | "createdAt") => {
    const raw = run[field];
    return raw ? formatDateTime(raw) : "-";
  };

  return (
    <section className="space-y-6">
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">{job.role}</h1>
            <p className="mt-1 text-slate-600">{job.company} · {job.location}</p>
          </div>
          <StatusBadge status={job.status} />
        </div>

        <p className="mt-4 text-sm leading-6 text-slate-700">{job.description}</p>

        <JobActions jobId={job.id} />
      </div>

      <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-base font-semibold text-slate-900">Auto Apply</h2>
        <p className="mt-2 text-sm text-amber-800">
          Auto Apply may fill forms using your saved profile and application packet. Review
          generated materials before approval. This workflow does not submit applications yet.
        </p>

        <dl className="mt-4 grid gap-3 text-sm md:grid-cols-2">
          <div>
            <dt className="font-medium text-slate-700">Status</dt>
            <dd className="mt-1 text-slate-900">{job.autoApplyStatus}</dd>
          </div>
          <div>
            <dt className="font-medium text-slate-700">Approved at</dt>
            <dd className="mt-1 text-slate-900">{formatDateTime(job.autoApplyApprovedAt)}</dd>
          </div>
        </dl>

        {job.autoApplyError ? (
          <p className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {job.autoApplyError}
          </p>
        ) : null}

        <div className="mt-4">
          <AutoApplyControls jobId={job.id} autoApplyEnabled={job.autoApplyEnabled} />
        </div>
      </article>

      {autoApplyRuns.length > 0 ? (
        <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-base font-semibold text-slate-900">Auto-Apply Run History</h2>
          <div className="mt-3 overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-slate-600">
                <tr>
                  <th className="px-3 py-2 font-semibold">Status</th>
                  <th className="px-3 py-2 font-semibold">Started</th>
                  <th className="px-3 py-2 font-semibold">Finished</th>
                  <th className="px-3 py-2 font-semibold">Error</th>
                  <th className="px-3 py-2 font-semibold">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {autoApplyRuns.map((run) => (
                  <tr key={run.id}>
                    <td className="px-3 py-2 text-slate-900">{run.status}</td>
                    <td className="px-3 py-2 text-slate-700">{renderRunDate(run, "startedAt")}</td>
                    <td className="px-3 py-2 text-slate-700">{renderRunDate(run, "finishedAt")}</td>
                    <td className="px-3 py-2 text-slate-700">{run.errorMessage || "-"}</td>
                    <td className="px-3 py-2 text-slate-700">{renderRunDate(run, "createdAt")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-base font-semibold text-slate-900">Match reason</h2>
          <p className="mt-2 text-sm text-slate-700">{job.matchReason}</p>
        </article>

        <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-base font-semibold text-slate-900">Risk notes</h2>
          <p className="mt-2 text-sm text-slate-700">{job.riskNotes}</p>
        </article>

        <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm md:col-span-2">
          <h2 className="text-base font-semibold text-slate-900">Tailored resume draft</h2>
          <p className="mt-2 text-sm text-slate-700">{job.tailoredResumeDraft}</p>
        </article>

        <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm md:col-span-2">
          <h2 className="text-base font-semibold text-slate-900">Cover letter draft</h2>
          <p className="mt-2 text-sm text-slate-700">{job.coverLetterDraft}</p>
        </article>

        <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm md:col-span-2">
          <h2 className="text-base font-semibold text-slate-900">Short-answer drafts</h2>
          <ul className="mt-2 list-disc space-y-2 pl-5 text-sm text-slate-700">
            {job.shortAnswerDrafts.map((draft) => (
              <li key={draft}>{draft}</li>
            ))}
          </ul>
        </article>
      </div>
    </section>
  );
}
