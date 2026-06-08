import Link from "next/link";

import { ResumeTemplateList } from "@/components/resumes/ResumeTemplateList";
import { ResumeUploadForm } from "@/components/resumes/ResumeUploadForm";
import { getResumeTemplates } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function ResumesPage() {
  const templates = await getResumeTemplates();

  return (
    <section className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Resume Templates</h1>
        <p className="text-slate-600">
          Upload Word resumes as canonical templates for future matching and packet generation.
        </p>
      </div>

      <ResumeUploadForm />

      <section className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-slate-900">Manage Existing Templates</h2>
          <Link href="/resumes/new-manual" className="text-sm font-medium text-slate-700 underline">
            Create Template Manually
          </Link>
        </div>
        <ResumeTemplateList templates={templates} />
      </section>

      <Link
        href="/profile"
        className="inline-block rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
      >
        Manage profile
      </Link>
    </section>
  );
}
