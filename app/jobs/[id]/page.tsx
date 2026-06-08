import { notFound } from "next/navigation";

import { JobActions } from "@/components/JobActions";
import { StatusBadge } from "@/components/StatusBadge";
import { getJob } from "@/lib/queries";

type JobDetailsProps = {
  params: Promise<{ id: string }>;
};

export default async function JobDetailsPage({ params }: JobDetailsProps) {
  const { id } = await params;
  const job = await getJob(id);

  if (!job) {
    notFound();
  }

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
