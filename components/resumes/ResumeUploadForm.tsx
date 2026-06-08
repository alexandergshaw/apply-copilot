"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState, useTransition } from "react";

import { createResumeTemplateFromDocx } from "@/app/resumes/actions";

const MAX_BYTES = 10 * 1024 * 1024;

type UploadState = {
  name: string;
  targetRole: string;
  isDefault: boolean;
  file: File | null;
};

const initialState: UploadState = {
  name: "",
  targetRole: "",
  isDefault: false,
  file: null,
};

export function ResumeUploadForm() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<UploadState>(initialState);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [progress, setProgress] = useState(0);
  const [isPending, startTransition] = useTransition();

  const isDocx = useMemo(
    () => Boolean(state.file && state.file.name.toLowerCase().endsWith(".docx")),
    [state.file],
  );

  const validateFile = (file: File | null): string | null => {
    if (!file) {
      return "Please choose a .docx file.";
    }

    if (!file.name.toLowerCase().endsWith(".docx")) {
      return "Only .docx files are supported.";
    }

    if (file.size > MAX_BYTES) {
      return "File is too large. Maximum size is 10 MB.";
    }

    return null;
  };

  const handleSelectedFile = (file: File | null) => {
    const validation = validateFile(file);
    setError(validation);
    setSuccess(null);
    setState((previous) => ({ ...previous, file }));
  };

  const submit = () => {
    const validation = validateFile(state.file);
    if (validation) {
      setError(validation);
      return;
    }

    setError(null);
    setSuccess(null);
    setProgress(10);

    const interval = window.setInterval(() => {
      setProgress((previous) => (previous >= 90 ? previous : previous + 10));
    }, 180);

    const formData = new FormData();
    formData.set("docx_file", state.file as File);
    formData.set("name", state.name);
    formData.set("target_role", state.targetRole);
    if (state.isDefault) {
      formData.set("is_default", "on");
    }

    startTransition(async () => {
      const result = await createResumeTemplateFromDocx(formData);
      window.clearInterval(interval);

      if (!result.ok && typeof result.id !== "number") {
        setError(result.message ?? "Unable to upload resume template.");
        setProgress(0);
        return;
      }

      if (!result.ok && typeof result.id === "number") {
        router.push(`/resumes/${result.id}?warning=extraction`);
        return;
      }

      setProgress(100);
      setSuccess(result.message ?? "Resume uploaded successfully.");
      router.push(`/resumes/${result.id}`);
    });
  };

  return (
    <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">Upload Resume (.docx)</h2>
        <p className="mt-1 text-sm text-slate-600">
          Upload your existing Word resume. The uploaded .docx is stored as the canonical template
          artifact.
        </p>
      </div>

      <button
        type="button"
        className={`w-full rounded-lg border border-dashed px-4 py-8 text-left transition ${
          dragging
            ? "border-slate-900 bg-slate-100"
            : "border-slate-300 bg-slate-50 hover:border-slate-400"
        }`}
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          const file = event.dataTransfer.files?.[0] ?? null;
          handleSelectedFile(file);
        }}
        onClick={() => fileInputRef.current?.click()}
      >
        <p className="text-sm font-medium text-slate-900">Drag and drop a .docx file here</p>
        <p className="mt-1 text-xs text-slate-600">or click to choose a file (max 10 MB)</p>
      </button>

      <input
        ref={fileInputRef}
        className="hidden"
        type="file"
        accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        onChange={(event) => handleSelectedFile(event.target.files?.[0] ?? null)}
      />

      <div className="grid gap-4 md:grid-cols-2">
        <label className="block text-sm text-slate-700">
          <span className="mb-1 block font-medium">Template name</span>
          <input
            className="w-full rounded-md border border-slate-300 bg-white px-3 py-2"
            value={state.name}
            onChange={(event) => setState((prev) => ({ ...prev, name: event.target.value }))}
            placeholder="e.g. PM Base Resume"
          />
        </label>

        <label className="block text-sm text-slate-700">
          <span className="mb-1 block font-medium">Target role</span>
          <input
            className="w-full rounded-md border border-slate-300 bg-white px-3 py-2"
            value={state.targetRole}
            onChange={(event) => setState((prev) => ({ ...prev, targetRole: event.target.value }))}
            placeholder="e.g. Senior Product Manager"
          />
        </label>
      </div>

      <label className="inline-flex items-center gap-2 text-sm font-medium text-slate-700">
        <input
          checked={state.isDefault}
          type="checkbox"
          onChange={(event) => setState((prev) => ({ ...prev, isDefault: event.target.checked }))}
        />
        Set as default template
      </label>

      {state.file ? (
        <p className="text-sm text-slate-700">
          Selected file: <span className="font-medium">{state.file.name}</span>
          {isDocx ? "" : " (invalid type)"}
        </p>
      ) : null}

      {isPending ? (
        <div className="space-y-1">
          <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
            <div className="h-full bg-slate-900 transition-all" style={{ width: `${progress}%` }} />
          </div>
          <p className="text-xs text-slate-600">Uploading and extracting text...</p>
        </div>
      ) : null}

      {error ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      {success ? (
        <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          {success}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-60"
          disabled={isPending}
          onClick={submit}
        >
          {isPending ? "Uploading..." : "Upload Resume (.docx)"}
        </button>

        <Link href="/resumes/new-manual" className="text-sm font-medium text-slate-700 underline">
          Create manually instead
        </Link>
      </div>
    </section>
  );
}
