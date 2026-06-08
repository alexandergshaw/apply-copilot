import { JobsBrowser } from "@/components/JobsBrowser";
import { getJobs } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function JobsPage() {
  const jobs = await getJobs();

  return (
    <section className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Jobs</h1>
        <p className="text-slate-600">Review opportunities and prioritize the highest-fit roles.</p>
      </div>

      <JobsBrowser jobs={jobs} />
    </section>
  );
}
