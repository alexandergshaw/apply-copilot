"use client";

import { useState, useTransition } from "react";

import { JsonTextarea } from "@/components/ui/JsonTextarea";

export type ResumeVersionFormValues = {
  name: string;
  targetRole: string;
  resumeText: string;
  resumeJson: string;
  isDefault: boolean;
};

type ActionResult = { ok: boolean; message?: string };

type ResumeVersionFormProps = {
  initialValues: ResumeVersionFormValues;
  submitLabel: string;
  onSubmit: (formData: FormData) => Promise<ActionResult>;
  onDelete?: () => Promise<ActionResult>;
  onSuccess?: () => void;
};

function parseResumeJson(value: string): { error?: string } {
  try {
    const parsed = JSON.parse(value || "{}");
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return { error: "Resume JSON must be a JSON object." };
    }

    return {};
  } catch {
    return { error: "Resume JSON contains invalid JSON." };
  }
}

export function ResumeVersionForm({
  initialValues,
  submitLabel,
  onSubmit,
  onDelete,
  onSuccess,
}: ResumeVersionFormProps) {
  const [values, setValues] = useState<ResumeVersionFormValues>(initialValues);
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const submit = () => {
    setMessage(null);

    const validation = parseResumeJson(values.resumeJson);
    if (validation.error) {
      setJsonError(validation.error);
      setMessage("Please fix JSON field errors before saving.");
      return;
    }

    setJsonError(null);

    const formData = new FormData();
    formData.set("name", values.name);
    formData.set("target_role", values.targetRole);
    formData.set("resume_text", values.resumeText);
    formData.set("resume_json", values.resumeJson || "{}");
    if (values.isDefault) {
      formData.set("is_default", "on");
    }

    startTransition(async () => {
      const result = await onSubmit(formData);
      setMessage(result.ok ? "Saved." : result.message ?? "Unable to save resume version.");
      if (result.ok) {
        onSuccess?.();
      }
    });
  };

  const remove = () => {
    if (!onDelete) {
      return;
    }

    const confirmed = window.confirm("Delete this resume version? This cannot be undone.");
    if (!confirmed) {
      return;
    }

    setMessage(null);
    startTransition(async () => {
      const result = await onDelete();
      setMessage(result.ok ? "Deleted." : result.message ?? "Unable to delete resume version.");
      if (result.ok) {
        onSuccess?.();
      }
    });
  };

  return (
    <form
      className="space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <div className="grid gap-4 md:grid-cols-2">
        <label className="block text-sm text-slate-700">
          <span className="mb-1 block font-medium">Name</span>
          <input
            required
            className="w-full rounded-md border border-slate-300 bg-white px-3 py-2"
            value={values.name}
            onChange={(event) => setValues((prev) => ({ ...prev, name: event.target.value }))}
          />
        </label>

        <label className="block text-sm text-slate-700">
          <span className="mb-1 block font-medium">Target role</span>
          <input
            className="w-full rounded-md border border-slate-300 bg-white px-3 py-2"
            value={values.targetRole}
            onChange={(event) => setValues((prev) => ({ ...prev, targetRole: event.target.value }))}
          />
        </label>
      </div>

      <label className="block text-sm text-slate-700">
        <span className="mb-1 block font-medium">Resume text</span>
        <textarea
          required
          className="min-h-64 w-full rounded-md border border-slate-300 bg-white px-3 py-2"
          value={values.resumeText}
          onChange={(event) => setValues((prev) => ({ ...prev, resumeText: event.target.value }))}
        />
      </label>

      <JsonTextarea
        id="resumeJson"
        label="Resume JSON"
        helperText="Optional structured metadata used for future packet generation. Must be a JSON object."
        value={values.resumeJson}
        onChange={(nextValue) => setValues((prev) => ({ ...prev, resumeJson: nextValue }))}
        error={jsonError ?? undefined}
        rows={12}
      />

      <label className="inline-flex items-center gap-2 text-sm font-medium text-slate-700">
        <input
          checked={values.isDefault}
          type="checkbox"
          onChange={(event) =>
            setValues((prev) => ({
              ...prev,
              isDefault: event.target.checked,
            }))
          }
        />
        Set as default resume version
      </label>

      {message ? (
        <p
          className={
            message === "Saved." || message === "Deleted."
              ? "rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800"
              : "rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
          }
        >
          {message}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <button
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-60"
          type="submit"
          disabled={isPending}
        >
          {isPending ? "Saving..." : submitLabel}
        </button>

        {onDelete ? (
          <button
            className="rounded-md border border-red-300 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-60"
            type="button"
            onClick={remove}
            disabled={isPending}
          >
            Delete
          </button>
        ) : null}
      </div>
    </form>
  );
}
