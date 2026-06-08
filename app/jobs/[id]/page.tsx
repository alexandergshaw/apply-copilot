import { notFound } from "next/navigation";

import { StatusBadge } from "@/components/StatusBadge";
import { jobs } from "@/lib/mock-data";

type JobDetailsProps = {
  params: Promise<{ id: string }>;
};

export default async function JobDetailsPage({ params }: JobDetailsProps) {
  const { id } = await params;
  const job = jobs.find((entry) => entry.id === id);

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

        <div className="mt-4 flex flex-wrap gap-2">
          <button className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700" type="button">
            Generate Packet
          </button>
          <button className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700" type="button">
            Save
          </button>
          <button className="rounded-md border border-red-200 px-4 py-2 text-sm font-medium text-red-700" type="button">
            Reject
          </button>
          <button className="rounded-md border border-blue-200 px-4 py-2 text-sm font-medium text-blue-700" type="button">
            Mark Applied
          </button>
        </div>
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
