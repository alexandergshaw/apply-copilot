import { ApplicationTable } from "@/components/ApplicationTable";
import { getApplications } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function ApplicationsPage() {
  const applications = await getApplications();

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
