import Link from "next/link";

import { JobsBrowser } from "@/components/JobsBrowser";
import { getJobs } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function JobsPage() {
  const jobs = await getJobs();

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Jobs</h1>
          <p className="text-slate-600">Review opportunities and prioritize the highest-fit roles.</p>
        </div>
        <Link
          className="inline-flex rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
          href="/jobs/import"
        >
          Import Job
        </Link>
      </div>

      <JobsBrowser jobs={jobs} />
    </section>
  );
}
