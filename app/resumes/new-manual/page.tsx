import Link from "next/link";

import { ManualResumeTemplateForm } from "@/components/resumes/ManualResumeTemplateForm";

export const dynamic = "force-dynamic";

export default function NewManualResumeTemplatePage() {
  return (
    <section className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Advanced: Create Template Manually</h1>
        <p className="text-slate-600">
          Manual template creation is a fallback path. Uploading .docx is the preferred workflow.
        </p>
      </div>

      <ManualResumeTemplateForm />

      <Link
        href="/resumes"
        className="inline-block rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
      >
        Back to Resume Templates
      </Link>
    </section>
  );
}
