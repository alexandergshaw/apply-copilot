import { JobUrlImportForm } from "@/components/jobs/JobUrlImportForm";

export const dynamic = "force-dynamic";

export default function JobImportPage() {
  return (
    <section className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Import Job</h1>
        <p className="text-slate-600">
          Import from URL first, then review and edit the extracted details before saving.
        </p>
      </div>

      <JobUrlImportForm />
    </section>
  );
}
