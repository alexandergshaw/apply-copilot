"use client";

import { useRouter } from "next/navigation";

import { createResumeVersion } from "@/app/resumes/actions";
import { ResumeVersionForm } from "@/components/resumes/ResumeVersionForm";

export function CreateResumeVersionSection() {
  const router = useRouter();

  return (
    <ResumeVersionForm
      initialValues={{
        name: "",
        targetRole: "",
        resumeText: "",
        resumeJson: "{}",
        isDefault: false,
      }}
      submitLabel="Create resume version"
      onSubmit={async (formData) => {
        const result = await createResumeVersion(formData);
        if (result.ok && typeof result.id === "number") {
          router.push(`/resumes/${result.id}`);
        }
        return result;
      }}
    />
  );
}
