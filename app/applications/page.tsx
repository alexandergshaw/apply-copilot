import { ApplicationTable } from "@/components/ApplicationTable";
import { applications } from "@/lib/mock-data";

export default function ApplicationsPage() {
  return (
    <section className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Applications</h1>
        <p className="text-slate-600">Track every application and follow-up in one place.</p>
      </div>
      <ApplicationTable applications={applications} />
    </section>
  );
}
