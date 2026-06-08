"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { createManualResumeTemplate } from "@/app/resumes/actions";
import { JsonTextarea } from "@/components/ui/JsonTextarea";

export function ManualResumeTemplateForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [targetRole, setTargetRole] = useState("");
  const [templateText, setTemplateText] = useState("");
  const [templateJson, setTemplateJson] = useState("{}");
  const [isDefault, setIsDefault] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const submit = () => {
    setMessage(null);

    try {
      const parsed = JSON.parse(templateJson || "{}");
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        setJsonError("Template JSON must be a JSON object.");
        return;
      }
      setJsonError(null);
    } catch {
      setJsonError("Template JSON contains invalid JSON.");
      return;
    }

    const formData = new FormData();
    formData.set("name", name);
    formData.set("target_role", targetRole);
    formData.set("template_text", templateText);
    formData.set("template_json", templateJson || "{}");
    if (isDefault) {
      formData.set("is_default", "on");
    }

    startTransition(async () => {
      const result = await createManualResumeTemplate(formData);
      if (!result.ok || typeof result.id !== "number") {
        setMessage(result.message ?? "Unable to create manual template.");
        return;
      }

      router.push(`/resumes/${result.id}`);
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
      <label className="block text-sm text-slate-700">
        <span className="mb-1 block font-medium">Name</span>
        <input
          required
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

      <label className="block text-sm text-slate-700">
        <span className="mb-1 block font-medium">Template text</span>
        <textarea
          required
          className="min-h-64 w-full rounded-md border border-slate-300 bg-white px-3 py-2"
          value={templateText}
          onChange={(event) => setTemplateText(event.target.value)}
        />
      </label>

      <JsonTextarea
        id="manualTemplateJson"
        label="template_json"
        value={templateJson}
        onChange={setTemplateJson}
        error={jsonError ?? undefined}
        rows={10}
      />

      <label className="inline-flex items-center gap-2 text-sm font-medium text-slate-700">
        <input
          checked={isDefault}
          type="checkbox"
          onChange={(event) => setIsDefault(event.target.checked)}
        />
        Set as default template
      </label>

      {message ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {message}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={isPending}
        className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-60"
      >
        {isPending ? "Saving..." : "Create manual template"}
      </button>
    </form>
  );
}
