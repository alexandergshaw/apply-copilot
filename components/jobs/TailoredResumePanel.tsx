"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

import {
  approveTailoredResume,
  generateTailoredResume,
  markTailoredResumeReviewed,
  regenerateTailoredResume,
  rejectTailoredResume,
  updateTailoredResumeText,
} from "@/app/jobs/[id]/actions";
import type { ResumeTemplate, TailoredResume } from "@/lib/supabase/types";

type TailoredResumePanelProps = {
  jobId: string;
  isManualImported: boolean;
  templates: ResumeTemplate[];
  tailoredResumes: TailoredResume[];
  defaultTemplateId: number | null;
};

function statusClass(status: TailoredResume["status"]): string {
  if (status === "approved") {
    return "border-emerald-200 bg-emerald-50 text-emerald-800";
  }
  if (status === "rejected") {
    return "border-red-200 bg-red-50 text-red-700";
  }
  if (status === "reviewed") {
    return "border-blue-200 bg-blue-50 text-blue-700";
  }
  if (status === "stale") {
    return "border-slate-300 bg-slate-100 text-slate-700";
  }
  return "border-amber-200 bg-amber-50 text-amber-800";
}

function formatNumber(value: number | null): string {
  if (value == null) {
    return "-";
  }

  return String(value);
}

export function TailoredResumePanel({
  jobId,
  isManualImported,
  templates,
  tailoredResumes,
  defaultTemplateId,
}: TailoredResumePanelProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  const initialTemplateId =
    defaultTemplateId ?? templates[0]?.id ?? null;

  const [selectedTemplateId, setSelectedTemplateId] = useState<number | null>(initialTemplateId);

  const currentTemplate = useMemo(
    () => templates.find((template) => template.id === selectedTemplateId) ?? null,
    [templates, selectedTemplateId],
  );

  const currentTailoredResume = useMemo(() => {
    if (!selectedTemplateId) {
      return null;
    }

    return (
      tailoredResumes.find((item) => item.resumeTemplateId === selectedTemplateId) ?? null
    );
  }, [selectedTemplateId, tailoredResumes]);

  const [tailoredText, setTailoredText] = useState(currentTailoredResume?.tailoredText ?? "");

  const syncTailoredText = (nextText: string) => {
    setTailoredText(nextText);
  };

  const run = (action: () => Promise<{ ok: boolean; message?: string }>) => {
    setMessage(null);
    startTransition(async () => {
      const result = await action();
      setMessage(result.ok ? "Saved." : result.message ?? "Action failed.");
      if (result.ok) {
        router.refresh();
      }
    });
  };

  if (!isManualImported) {
    return (
      <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-base font-semibold text-slate-900">Resume Tailoring</h2>
        <p className="mt-2 text-sm text-slate-600">
          Resume tailoring from this page is currently available only for manually imported jobs.
        </p>
      </article>
    );
  }

  if (templates.length === 0) {
    return (
      <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-base font-semibold text-slate-900">Resume Tailoring</h2>
        <p className="mt-2 text-sm text-slate-600">No resume templates found.</p>
        <Link
          href="/resumes"
          className="mt-3 inline-block rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
        >
          Upload Resume Template
        </Link>
      </article>
    );
  }

  return (
    <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-base font-semibold text-slate-900">Resume Tailoring</h2>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <label className="block text-sm text-slate-700">
          <span className="mb-1 block font-medium">Resume Template</span>
          <select
            className="w-full rounded-md border border-slate-300 bg-white px-3 py-2"
            value={selectedTemplateId ?? ""}
            onChange={(event) => {
              const nextId = Number.parseInt(event.target.value, 10);
              setSelectedTemplateId(Number.isNaN(nextId) ? null : nextId);
              const nextTailored = tailoredResumes.find((entry) => entry.resumeTemplateId === nextId);
              setTailoredText(nextTailored?.tailoredText ?? "");
            }}
          >
            {templates.map((template) => (
              <option key={template.id} value={template.id}>
                {template.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      {currentTemplate ? (
        <div className="mt-4 rounded-md border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
          <p><span className="font-medium text-slate-900">Template:</span> {currentTemplate.name}</p>
          <p><span className="font-medium text-slate-900">Target role:</span> {currentTemplate.targetRole || "-"}</p>
          <p><span className="font-medium text-slate-900">Upload source:</span> {currentTemplate.uploadSource}</p>
          <p><span className="font-medium text-slate-900">Original filename:</span> {currentTemplate.originalFilename || "-"}</p>
        </div>
      ) : null}

      {currentTailoredResume ? (
        <div className="mt-4 space-y-2 rounded-md border border-slate-200 p-3 text-sm text-slate-700">
          <p>
            <span className="font-medium text-slate-900">Status:</span>{" "}
            <span className={`rounded-full border px-2 py-1 text-xs ${statusClass(currentTailoredResume.status)}`}>
              {currentTailoredResume.status}
            </span>
          </p>
          <p>
            <span className="font-medium text-slate-900">Match score:</span>{" "}
            {formatNumber(currentTailoredResume.matchScore)}
          </p>
          <p>
            <span className="font-medium text-slate-900">Tailoring notes:</span>{" "}
            {currentTailoredResume.tailoringNotes || "-"}
          </p>
          <div>
            <p className="font-medium text-slate-900">Keyword coverage</p>
            <pre className="mt-1 overflow-x-auto rounded-md bg-slate-100 p-2 text-xs">
              {JSON.stringify(currentTailoredResume.keywordCoverage, null, 2)}
            </pre>
          </div>
        </div>
      ) : null}

      <label className="mt-4 block text-sm text-slate-700">
        <span className="mb-1 block font-medium">Tailored Resume Draft</span>
        <textarea
          className="min-h-72 w-full rounded-md border border-slate-300 bg-white px-3 py-2"
          value={tailoredText}
          onChange={(event) => syncTailoredText(event.target.value)}
          placeholder="Generate a tailored resume draft to review and edit."
        />
      </label>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={isPending || !selectedTemplateId}
          onClick={() => {
            if (!selectedTemplateId) {
              return;
            }
            run(() => generateTailoredResume(jobId, selectedTemplateId));
          }}
          className="rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-60"
        >
          Generate Tailored Resume
        </button>

        <button
          type="button"
          disabled={isPending || !selectedTemplateId}
          onClick={() => {
            if (!selectedTemplateId) {
              return;
            }
            run(() => regenerateTailoredResume(jobId, selectedTemplateId));
          }}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-60"
        >
          Regenerate Resume
        </button>

        <button
          type="button"
          disabled={isPending || !currentTailoredResume}
          onClick={() => {
            if (!currentTailoredResume) {
              return;
            }
            run(() => updateTailoredResumeText(currentTailoredResume.id, tailoredText));
          }}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-60"
        >
          Save Draft Text
        </button>

        <button
          type="button"
          disabled={isPending || !currentTailoredResume}
          onClick={() => {
            if (!currentTailoredResume) {
              return;
            }
            run(() => markTailoredResumeReviewed(currentTailoredResume.id));
          }}
          className="rounded-md border border-blue-200 px-3 py-2 text-sm font-medium text-blue-700 hover:bg-blue-50 disabled:opacity-60"
        >
          Mark Reviewed
        </button>

        <button
          type="button"
          disabled={isPending || !currentTailoredResume}
          onClick={() => {
            if (!currentTailoredResume) {
              return;
            }
            run(() => approveTailoredResume(currentTailoredResume.id));
          }}
          className="rounded-md border border-emerald-200 px-3 py-2 text-sm font-medium text-emerald-700 hover:bg-emerald-50 disabled:opacity-60"
        >
          Approve Resume
        </button>

        <button
          type="button"
          disabled={isPending || !currentTailoredResume}
          onClick={() => {
            if (!currentTailoredResume) {
              return;
            }
            run(() => rejectTailoredResume(currentTailoredResume.id));
          }}
          className="rounded-md border border-red-200 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-60"
        >
          Reject Resume
        </button>
      </div>

      {message ? (
        <p className="mt-3 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
          {message}
        </p>
      ) : null}
    </article>
  );
}
