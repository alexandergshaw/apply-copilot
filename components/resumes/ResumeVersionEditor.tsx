"use client";

import { useRouter } from "next/navigation";

import { deleteResumeVersion } from "@/app/resumes/actions";
import { updateResumeVersion } from "@/app/resumes/[id]/actions";
import { ResumeVersionForm } from "@/components/resumes/ResumeVersionForm";
import type { ResumeVersion } from "@/lib/supabase/types";

type ResumeVersionEditorProps = {
  resume: ResumeVersion;
};

export function ResumeVersionEditor({ resume }: ResumeVersionEditorProps) {
  const router = useRouter();

  return (
    <div>
      <ResumeVersionForm
        initialValues={{
          name: resume.name,
          targetRole: resume.targetRole,
          resumeText: resume.resumeText,
          resumeJson: JSON.stringify(resume.resumeJson, null, 2),
          isDefault: resume.isDefault,
        }}
        submitLabel="Save resume version"
        onSubmit={(formData) => updateResumeVersion(resume.id, formData)}
        onDelete={async () => {
          const result = await deleteResumeVersion(resume.id);
          if (result.ok) {
            router.push("/resumes");
          }
          return result;
        }}
      />
    </div>
  );
}
