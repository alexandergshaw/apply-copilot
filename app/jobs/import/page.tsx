import { ManualJobImportForm } from "@/components/jobs/ManualJobImportForm";

export const dynamic = "force-dynamic";

export default function JobImportPage() {
  return (
    <section className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Import Job</h1>
        <p className="text-slate-600">
          Manually add a job posting and optionally queue it for future auto-apply processing.
        </p>
      </div>

      <ManualJobImportForm />
    </section>
  );
}
