import Link from "next/link";
import { notFound } from "next/navigation";

import { ResumeVersionEditor } from "@/components/resumes/ResumeVersionEditor";
import { getResumeVersionById } from "@/lib/queries";

type ResumeDetailPageProps = {
  params: Promise<{ id: string }>;
};

export const dynamic = "force-dynamic";

export default async function ResumeDetailPage({ params }: ResumeDetailPageProps) {
  const { id } = await params;
  const resumeId = Number.parseInt(id, 10);
  if (Number.isNaN(resumeId)) {
    notFound();
  }

  const resume = await getResumeVersionById(resumeId);
  if (!resume) {
    notFound();
  }

  return (
    <section className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Resume Version</h1>
        <p className="text-slate-600">
          Edit this resume version for future matching and application packet generation.
        </p>
      </div>

      <ResumeVersionEditor resume={resume} />

      <Link
        className="inline-block rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
        href="/resumes"
      >
        Back to Resumes
      </Link>
    </section>
  );
}
