"use client";

import { useState, useTransition } from "react";

import { fetchJobFromUrl } from "@/app/jobs/import/actions";
import type { ExtractedJobPosting } from "@/lib/job-import";

import { JobImportPreviewForm } from "./JobImportPreviewForm";
import { ManualJobImportForm } from "./ManualJobImportForm";

type ImportMode = "url" | "manual";

export function JobUrlImportForm() {
  const [mode, setMode] = useState<ImportMode>("url");
  const [jobUrl, setJobUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [extracted, setExtracted] = useState<ExtractedJobPosting | null>(null);
  const [submittedUrl, setSubmittedUrl] = useState("");
  const [isPending, startTransition] = useTransition();

  const submit = () => {
    setError(null);
    setExtracted(null);

    const formData = new FormData();
    formData.set("url", jobUrl);

    startTransition(async () => {
      const result = await fetchJobFromUrl(formData);
      if (!result.ok || !result.data) {
        setError(result.message ?? "Unable to import from this URL.");
        return;
      }

      setExtracted(result.data);
      setSubmittedUrl(jobUrl.trim());
    });
  };

  return (
    <section className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-white p-2 shadow-sm">
        <div className="grid gap-2 md:grid-cols-2">
          <button
            type="button"
            className={`rounded-lg px-4 py-3 text-left text-sm font-semibold transition ${
              mode === "url"
                ? "bg-slate-900 text-white"
                : "bg-slate-100 text-slate-700 hover:bg-slate-200"
            }`}
            onClick={() => setMode("url")}
          >
            Import from URL
          </button>
          <button
            type="button"
            className={`rounded-lg px-4 py-3 text-left text-sm font-semibold transition ${
              mode === "manual"
                ? "bg-slate-900 text-white"
                : "bg-slate-100 text-slate-700 hover:bg-slate-200"
            }`}
            onClick={() => setMode("manual")}
          >
            Paste manually
          </button>
        </div>
      </div>

      {mode === "url" ? (
        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Import from URL</h2>
          <p className="mt-2 text-sm text-slate-600">
            Paste a public job posting URL and we will extract details for you to review before
            saving.
          </p>

          <form
            className="mt-5 space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              submit();
            }}
          >
            <label className="block text-sm text-slate-700">
              <span className="mb-1 block font-medium">Job URL</span>
              <input
                required
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2"
                type="url"
                value={jobUrl}
                onChange={(event) => setJobUrl(event.target.value)}
                placeholder="https://example.com/jobs/software-engineer"
              />
            </label>

            {error ? (
              <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </p>
            ) : null}

            <div>
              <button
                type="submit"
                className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-60"
                disabled={isPending}
              >
                {isPending ? "Fetching..." : "Fetch Job Details"}
              </button>
            </div>
          </form>
        </section>
      ) : (
        <ManualJobImportForm
          title="Paste Manually"
          description="Use this fallback when URL extraction does not work for a job posting."
        />
      )}

      {mode === "url" && extracted ? (
        <JobImportPreviewForm extracted={extracted} submittedUrl={submittedUrl} />
      ) : null}
    </section>
  );
}
