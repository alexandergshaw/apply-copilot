import { SourceForm } from "@/components/SourceForm";
import { jobSources } from "@/lib/mock-data";

export default function SourcesPage() {
  return (
    <section className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Sources</h1>
        <p className="text-slate-600">Manage where job opportunities are collected from.</p>
      </div>
      <SourceForm initialSources={jobSources} />
    </section>
  );
}
