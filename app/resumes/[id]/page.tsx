import Link from "next/link";
import { notFound } from "next/navigation";

import { ResumeTemplateEditor } from "@/components/resumes/ResumeTemplateEditor";
import { getResumeTemplateById } from "@/lib/queries";
import { getSupabaseServerClient } from "@/lib/supabase/server";

type ResumeDetailPageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ warning?: string }>;
};

export const dynamic = "force-dynamic";

export default async function ResumeDetailPage({ params, searchParams }: ResumeDetailPageProps) {
  const { id } = await params;
  const search = await searchParams;
  const resumeId = Number.parseInt(id, 10);
  if (Number.isNaN(resumeId)) {
    notFound();
  }

  const template = await getResumeTemplateById(resumeId);
  if (!template) {
    notFound();
  }

  const supabase = getSupabaseServerClient();
  let downloadUrl: string | null = null;

  if (supabase && template.docxStoragePath) {
    const { data } = await supabase.storage
      .from("resume-templates")
      .createSignedUrl(template.docxStoragePath, 60 * 30);
    downloadUrl = data?.signedUrl ?? null;
  }

  return (
    <section className="space-y-4">
      {search.warning === "extraction" ? (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          The .docx file uploaded successfully, but text extraction failed. Edit extracted text manually.
        </p>
      ) : null}

      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Resume Template</h1>
        <p className="text-slate-600">
          Manage canonical resume file, extracted text, and metadata for this template.
        </p>
      </div>

      <ResumeTemplateEditor template={template} downloadUrl={downloadUrl} />

      <Link
        className="inline-block rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
        href="/resumes"
      >
        Back to Resume Templates
      </Link>
    </section>
  );
}
