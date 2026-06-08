"use client";

import { useState, useTransition } from "react";

import { saveProfile } from "@/app/profile/actions";
import type { ProfileFormValues } from "@/lib/profile-form";
import { parseJsonArray, parseJsonObject } from "@/lib/profile-form";
import { JsonTextarea } from "@/components/ui/JsonTextarea";

type ProfileFormProps = {
  initialValues: ProfileFormValues;
};

type JsonFieldKey =
  | "workHistory"
  | "education"
  | "certifications"
  | "projects"
  | "preferences";

const jsonLabels: Record<JsonFieldKey, string> = {
  workHistory: "Work history",
  education: "Education",
  certifications: "Certifications",
  projects: "Projects",
  preferences: "Preferences",
};

export function ProfileForm({ initialValues }: ProfileFormProps) {
  const [values, setValues] = useState<ProfileFormValues>(initialValues);
  const [jsonErrors, setJsonErrors] = useState<Partial<Record<JsonFieldKey, string>>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const setField = (key: keyof ProfileFormValues, value: string) => {
    setValues((previous) => ({ ...previous, [key]: value }));
  };

  const validateJsonFields = () => {
    const nextErrors: Partial<Record<JsonFieldKey, string>> = {};

    const workHistory = parseJsonArray(values.workHistory, jsonLabels.workHistory);
    if (workHistory.error) {
      nextErrors.workHistory = workHistory.error;
    }

    const education = parseJsonArray(values.education, jsonLabels.education);
    if (education.error) {
      nextErrors.education = education.error;
    }

    const certifications = parseJsonArray(values.certifications, jsonLabels.certifications);
    if (certifications.error) {
      nextErrors.certifications = certifications.error;
    }

    const projects = parseJsonArray(values.projects, jsonLabels.projects);
    if (projects.error) {
      nextErrors.projects = projects.error;
    }

    const preferences = parseJsonObject(values.preferences, jsonLabels.preferences);
    if (preferences.error) {
      nextErrors.preferences = preferences.error;
    }

    setJsonErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const submit = () => {
    setMessage(null);

    if (!validateJsonFields()) {
      setMessage("Please fix JSON field errors before saving.");
      return;
    }

    const formData = new FormData();
    formData.set("id", values.id);
    formData.set("name", values.name);
    formData.set("email", values.email);
    formData.set("phone", values.phone);
    formData.set("location", values.location);
    formData.set("linkedin_url", values.linkedinUrl);
    formData.set("portfolio_url", values.portfolioUrl);
    formData.set("github_url", values.githubUrl);
    formData.set("target_titles", values.targetTitles);
    formData.set("target_locations", values.targetLocations);
    formData.set("min_salary", values.minSalary);
    formData.set("remote_preference", values.remotePreference);
    formData.set("skills", values.skills);
    formData.set("summary", values.summary);
    formData.set("resume_text", values.resumeText);
    formData.set("work_history", values.workHistory);
    formData.set("education", values.education);
    formData.set("certifications", values.certifications);
    formData.set("projects", values.projects);
    formData.set("preferences", values.preferences);

    startTransition(async () => {
      const result = await saveProfile(formData);
      setMessage(result.ok ? "Profile saved." : result.message ?? "Unable to save profile.");
    });
  };

  return (
    <form
      className="space-y-5"
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Contact</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <label className="block text-sm text-slate-700">
            <span className="mb-1 block font-medium">Name</span>
            <input
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2"
              value={values.name}
              onChange={(event) => setField("name", event.target.value)}
            />
          </label>

          <label className="block text-sm text-slate-700">
            <span className="mb-1 block font-medium">Email</span>
            <input
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2"
              type="email"
              value={values.email}
              onChange={(event) => setField("email", event.target.value)}
            />
          </label>

          <label className="block text-sm text-slate-700">
            <span className="mb-1 block font-medium">Phone</span>
            <input
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2"
              value={values.phone}
              onChange={(event) => setField("phone", event.target.value)}
            />
          </label>

          <label className="block text-sm text-slate-700">
            <span className="mb-1 block font-medium">Location</span>
            <input
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2"
              value={values.location}
              onChange={(event) => setField("location", event.target.value)}
            />
          </label>

          <label className="block text-sm text-slate-700">
            <span className="mb-1 block font-medium">LinkedIn URL</span>
            <input
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2"
              type="url"
              value={values.linkedinUrl}
              onChange={(event) => setField("linkedinUrl", event.target.value)}
            />
          </label>

          <label className="block text-sm text-slate-700">
            <span className="mb-1 block font-medium">Portfolio URL</span>
            <input
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2"
              type="url"
              value={values.portfolioUrl}
              onChange={(event) => setField("portfolioUrl", event.target.value)}
            />
          </label>

          <label className="block text-sm text-slate-700 md:col-span-2">
            <span className="mb-1 block font-medium">GitHub URL</span>
            <input
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2"
              type="url"
              value={values.githubUrl}
              onChange={(event) => setField("githubUrl", event.target.value)}
            />
          </label>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Job Targets</h2>
        <p className="mt-1 text-xs text-slate-500">Use comma-separated values for list fields.</p>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <label className="block text-sm text-slate-700 md:col-span-2">
            <span className="mb-1 block font-medium">Target titles</span>
            <input
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2"
              value={values.targetTitles}
              onChange={(event) => setField("targetTitles", event.target.value)}
            />
          </label>

          <label className="block text-sm text-slate-700 md:col-span-2">
            <span className="mb-1 block font-medium">Target locations</span>
            <input
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2"
              value={values.targetLocations}
              onChange={(event) => setField("targetLocations", event.target.value)}
            />
          </label>

          <label className="block text-sm text-slate-700">
            <span className="mb-1 block font-medium">Minimum salary</span>
            <input
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2"
              type="number"
              min={0}
              value={values.minSalary}
              onChange={(event) => setField("minSalary", event.target.value)}
            />
          </label>

          <label className="block text-sm text-slate-700">
            <span className="mb-1 block font-medium">Remote preference</span>
            <select
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2"
              value={values.remotePreference}
              onChange={(event) => setField("remotePreference", event.target.value)}
            >
              <option value="remote">Remote</option>
              <option value="hybrid">Hybrid</option>
              <option value="onsite">Onsite</option>
            </select>
          </label>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Skills</h2>
        <p className="mt-1 text-xs text-slate-500">Comma-separated values.</p>
        <label className="mt-4 block text-sm text-slate-700">
          <span className="mb-1 block font-medium">Skills</span>
          <textarea
            className="min-h-24 w-full rounded-md border border-slate-300 bg-white px-3 py-2"
            value={values.skills}
            onChange={(event) => setField("skills", event.target.value)}
          />
        </label>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Professional Summary</h2>
        <label className="mt-4 block text-sm text-slate-700">
          <span className="mb-1 block font-medium">Summary</span>
          <textarea
            className="min-h-32 w-full rounded-md border border-slate-300 bg-white px-3 py-2"
            value={values.summary}
            onChange={(event) => setField("summary", event.target.value)}
          />
        </label>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Structured Background</h2>
        <div className="mt-4 grid gap-4">
          <JsonTextarea
            id="workHistory"
            label="Work history JSON"
            helperText="Must be a JSON array."
            value={values.workHistory}
            error={jsonErrors.workHistory}
            onChange={(value) => setField("workHistory", value)}
            rows={12}
          />
          <JsonTextarea
            id="education"
            label="Education JSON"
            helperText="Must be a JSON array."
            value={values.education}
            error={jsonErrors.education}
            onChange={(value) => setField("education", value)}
            rows={10}
          />
          <JsonTextarea
            id="certifications"
            label="Certifications JSON"
            helperText="Must be a JSON array."
            value={values.certifications}
            error={jsonErrors.certifications}
            onChange={(value) => setField("certifications", value)}
            rows={8}
          />
          <JsonTextarea
            id="projects"
            label="Projects JSON"
            helperText="Must be a JSON array."
            value={values.projects}
            error={jsonErrors.projects}
            onChange={(value) => setField("projects", value)}
            rows={10}
          />
          <JsonTextarea
            id="preferences"
            label="Preferences JSON"
            helperText="Must be a JSON object."
            value={values.preferences}
            error={jsonErrors.preferences}
            onChange={(value) => setField("preferences", value)}
            rows={8}
          />
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Base Resume Text</h2>
        <label className="mt-4 block text-sm text-slate-700">
          <span className="mb-1 block font-medium">Resume text</span>
          <textarea
            className="min-h-64 w-full rounded-md border border-slate-300 bg-white px-3 py-2"
            value={values.resumeText}
            onChange={(event) => setField("resumeText", event.target.value)}
          />
        </label>
      </section>

      {message ? (
        <p
          className={
            message === "Profile saved."
              ? "rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800"
              : "rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
          }
        >
          {message}
        </p>
      ) : null}

      <button
        className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-60"
        type="submit"
        disabled={isPending}
      >
        {isPending ? "Saving..." : "Save profile"}
      </button>
    </form>
  );
}
