"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { deleteResumeTemplate } from "@/app/resumes/actions";
import { replaceResumeTemplateDocx, updateResumeTemplate } from "@/app/resumes/[id]/actions";
import { JsonTextarea } from "@/components/ui/JsonTextarea";
import type { ResumeTemplate } from "@/lib/supabase/types";

type ActionResult = { ok: boolean; message?: string };

type ResumeTemplateEditorProps = {
  template: ResumeTemplate;
  downloadUrl: string | null;
};

function parseTemplateJson(value: string): { error?: string } {
  try {
    const parsed = JSON.parse(value || "{}");
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return { error: "Template JSON must be a JSON object." };
    }
    return {};
  } catch {
    return { error: "Template JSON contains invalid JSON." };
  }
}

export function ResumeTemplateEditor({ template, downloadUrl }: ResumeTemplateEditorProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [jsonError, setJsonError] = useState<string | null>(null);

  const [name, setName] = useState(template.name);
  const [targetRole, setTargetRole] = useState(template.targetRole);
  const [isDefault, setIsDefault] = useState(template.isDefault);
  const [extractedText, setExtractedText] = useState(template.extractedText);
  const [templateText, setTemplateText] = useState(template.templateText);
  const [templateJson, setTemplateJson] = useState(JSON.stringify(template.templateJson, null, 2));

  const submitMetadata = () => {
    setMessage(null);

    const jsonValidation = parseTemplateJson(templateJson);
    if (jsonValidation.error) {
      setJsonError(jsonValidation.error);
      setMessage("Please fix JSON field errors before saving.");
      return;
    }

    setJsonError(null);

    const formData = new FormData();
    formData.set("name", name);
    formData.set("target_role", targetRole);
    formData.set("extracted_text", extractedText);
    formData.set("template_text", templateText);
    formData.set("template_json", templateJson || "{}");
    if (isDefault) {
      formData.set("is_default", "on");
    }

    startTransition(async () => {
      const result = await updateResumeTemplate(template.id, formData);
      setMessage(result.ok ? "Template saved." : result.message ?? "Unable to save template.");
      if (result.ok) {
        router.refresh();
      }
    });
  };

  const replaceDocx = (file: File | null) => {
    if (!file) {
      return;
    }

    const formData = new FormData();
    formData.set("docx_file", file);

    startTransition(async () => {
      const result = await replaceResumeTemplateDocx(template.id, formData);
      setMessage(
        result.ok
          ? "Resume file replaced and extracted text refreshed."
          : result.message ?? "Unable to replace resume file.",
      );
      router.refresh();
    });
  };

  const removeTemplate = () => {
    if (!window.confirm("Delete this resume template?")) {
      return;
    }

    startTransition(async () => {
      const result: ActionResult = await deleteResumeTemplate(template.id);
      if (!result.ok) {
        setMessage(result.message ?? "Unable to delete template.");
        return;
      }
      router.push("/resumes");
    });
  };

  return (
    <section className="space-y-5">
      <article className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Resume File</h2>
        <dl className="mt-3 space-y-2 text-sm text-slate-700">
          <div>
            <dt className="font-medium text-slate-900">Original filename</dt>
            <dd>{template.originalFilename || "No uploaded file"}</dd>
          </div>
        </dl>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          {downloadUrl ? (
            <a
              href={downloadUrl}
              target="_blank"
              rel="noreferrer"
              className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
            >
              Download
            </a>
          ) : null}

          <label className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100">
            Replace Resume
            <input
              className="hidden"
              type="file"
              accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              onChange={(event) => replaceDocx(event.target.files?.[0] ?? null)}
            />
          </label>
        </div>
      </article>

      <article className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Extracted Text</h2>
        <p className="mt-1 text-xs text-slate-500">
          AI tailoring should run against extracted text while preserving the original .docx artifact.
        </p>
        <textarea
          className="mt-4 min-h-72 w-full rounded-md border border-slate-300 bg-white px-3 py-2"
          value={extractedText}
          onChange={(event) => setExtractedText(event.target.value)}
        />
      </article>

      <article className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Metadata</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <label className="block text-sm text-slate-700">
            <span className="mb-1 block font-medium">Name</span>
            <input
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </label>

          <label className="block text-sm text-slate-700">
            <span className="mb-1 block font-medium">Target role</span>
            <input
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2"
              value={targetRole}
              onChange={(event) => setTargetRole(event.target.value)}
            />
          </label>
        </div>

        <label className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-slate-700">
          <input
            checked={isDefault}
            type="checkbox"
            onChange={(event) => setIsDefault(event.target.checked)}
          />
          Set as default template
        </label>
      </article>

      <article className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Template Text</h2>
        <p className="mt-1 text-xs text-slate-500">
          Used as fallback when extracted text is unavailable.
        </p>
        <textarea
          className="mt-4 min-h-72 w-full rounded-md border border-slate-300 bg-white px-3 py-2"
          value={templateText}
          onChange={(event) => setTemplateText(event.target.value)}
        />
      </article>

      <article className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Advanced</h2>
        <div className="mt-4">
          <JsonTextarea
            id="templateJson"
            label="template_json"
            helperText="Optional metadata object for future formatting-aware generation."
            value={templateJson}
            onChange={setTemplateJson}
            error={jsonError ?? undefined}
            rows={12}
          />
        </div>
      </article>

      {message ? (
        <p
          className={
            message.includes("saved") || message.includes("replaced")
              ? "rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800"
              : "rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
          }
        >
          {message}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={isPending}
          onClick={submitMetadata}
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-60"
        >
          {isPending ? "Saving..." : "Save template"}
        </button>
        <button
          type="button"
          disabled={isPending}
          onClick={removeTemplate}
          className="rounded-md border border-red-300 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-60"
        >
          Delete template
        </button>
      </div>
    </section>
  );
}
