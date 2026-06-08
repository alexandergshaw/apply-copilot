import { DashboardCard } from "@/components/DashboardCard";
import { jobs } from "@/lib/mock-data";

const totalJobs = jobs.length;
const reviewQueue = jobs.filter((job) => job.status === "review").length;
const applied = jobs.filter((job) => job.status === "applied").length;
const rejected = jobs.filter((job) => job.status === "rejected").length;

export default function DashboardPage() {
  return (
    <section className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Dashboard</h1>
        <p className="text-slate-600">Track your current hiring pipeline at a glance.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <DashboardCard label="Jobs found" value={totalJobs} />
        <DashboardCard label="Review queue" value={reviewQueue} />
        <DashboardCard label="Applied" value={applied} />
        <DashboardCard label="Rejected" value={rejected} />
      </div>
    </section>
  );
}
