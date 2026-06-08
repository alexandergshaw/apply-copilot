"use client";

import Link from "next/link";
import { useState, useTransition } from "react";

import { createManualJob } from "@/app/jobs/import/actions";

type FormState = {
  title: string;
  company: string;
  location: string;
  salary: string;
  applyUrl: string;
  description: string;
  status: string;
  queueForAutoApply: boolean;
};

const initialState: FormState = {
  title: "",
  company: "",
  location: "",
  salary: "",
  applyUrl: "",
  description: "",
  status: "found",
  queueForAutoApply: false,
};

export function ManualJobImportForm() {
  const [form, setForm] = useState<FormState>(initialState);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const submit = () => {
    setError(null);

    if (!form.title.trim()) {
      setError("Title is required.");
      return;
    }

    const formData = new FormData();
    formData.set("title", form.title);
    formData.set("company", form.company);
    formData.set("location", form.location);
    formData.set("salary", form.salary);
    formData.set("apply_url", form.applyUrl);
    formData.set("description", form.description);
    formData.set("status", form.status);
    if (form.queueForAutoApply) {
      formData.set("queue_for_auto_apply", "on");
    }

    startTransition(async () => {
      const result = await createManualJob(formData);
      if (!result.ok) {
        setError(result.message ?? "Unable to import job.");
      }
    });
  };

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-900">Manual Job Import</h2>
      <p className="mt-2 text-sm text-slate-600">
        Paste a job posting and save it to your queue. You can approve auto-apply now or later per
        job.
      </p>

      <form
        className="mt-5 space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <label className="block text-sm text-slate-700">
          <span className="mb-1 block font-medium">Title</span>
          <input
            required
            className="w-full rounded-md border border-slate-300 bg-white px-3 py-2"
            type="text"
            value={form.title}
            onChange={(event) => setForm({ ...form, title: event.target.value })}
          />
        </label>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="block text-sm text-slate-700">
            <span className="mb-1 block font-medium">Company</span>
            <input
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2"
              type="text"
              value={form.company}
              onChange={(event) => setForm({ ...form, company: event.target.value })}
            />
          </label>

          <label className="block text-sm text-slate-700">
            <span className="mb-1 block font-medium">Location</span>
            <input
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2"
              type="text"
              value={form.location}
              onChange={(event) => setForm({ ...form, location: event.target.value })}
            />
          </label>

          <label className="block text-sm text-slate-700">
            <span className="mb-1 block font-medium">Salary</span>
            <input
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2"
              type="text"
              value={form.salary}
              onChange={(event) => setForm({ ...form, salary: event.target.value })}
            />
          </label>

          <label className="block text-sm text-slate-700">
            <span className="mb-1 block font-medium">Apply URL</span>
            <input
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2"
              type="url"
              value={form.applyUrl}
              onChange={(event) => setForm({ ...form, applyUrl: event.target.value })}
            />
          </label>
        </div>

        <label className="block text-sm text-slate-700">
          <span className="mb-1 block font-medium">Description</span>
          <textarea
            className="min-h-72 w-full rounded-md border border-slate-300 bg-white px-3 py-2"
            value={form.description}
            onChange={(event) => setForm({ ...form, description: event.target.value })}
          />
        </label>

        <label className="block text-sm text-slate-700">
          <span className="mb-1 block font-medium">Status</span>
          <select
            className="w-full rounded-md border border-slate-300 bg-white px-3 py-2"
            value={form.status}
            onChange={(event) => setForm({ ...form, status: event.target.value })}
          >
            <option value="found">Found</option>
            <option value="saved">Saved</option>
            <option value="applied">Applied</option>
            <option value="rejected">Rejected</option>
          </select>
        </label>

        <label className="inline-flex items-center gap-2 text-sm font-medium text-slate-700">
          <input
            checked={form.queueForAutoApply}
            type="checkbox"
            onChange={(event) => setForm({ ...form, queueForAutoApply: event.target.checked })}
          />
          Queue for auto-apply after saving
        </label>

        {error ? (
          <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        ) : null}

        <div className="flex flex-wrap gap-2">
          <button
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-60"
            type="submit"
            disabled={isPending}
          >
            {isPending ? "Saving..." : "Save job"}
          </button>
          <Link
            className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700"
            href="/jobs"
          >
            Back to Jobs
          </Link>
        </div>
      </form>
    </section>
  );
}
