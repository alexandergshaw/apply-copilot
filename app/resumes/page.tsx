import Link from "next/link";

import { CreateResumeVersionSection } from "@/components/resumes/CreateResumeVersionSection";
import { ResumeVersionList } from "@/components/resumes/ResumeVersionList";
import { getResumeVersions } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function ResumesPage() {
  const resumes = await getResumeVersions();

  return (
    <section className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Resumes</h1>
        <p className="text-slate-600">
          Manage resume versions for role-specific tailoring and future application packets.
        </p>
      </div>

      <ResumeVersionList resumes={resumes} />

      <section className="space-y-2">
        <h2 className="text-lg font-semibold text-slate-900">Create Resume Version</h2>
        <CreateResumeVersionSection />
      </section>

      <Link
        href="/profile"
        className="inline-block rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
      >
        Edit profile
      </Link>
    </section>
  );
}
