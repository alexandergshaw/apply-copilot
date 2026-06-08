"use client";

import Link from "next/link";
import { useTransition } from "react";

import { deleteResumeTemplate, setDefaultResumeTemplate } from "@/app/resumes/actions";
import type { ResumeTemplate } from "@/lib/supabase/types";

type ResumeTemplateListProps = {
  templates: ResumeTemplate[];
};

function formatDateTime(value: string): string {
  if (!value) {
    return "-";
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function sourceLabel(source: ResumeTemplate["uploadSource"]): string {
  return source === "manual" ? "Manual" : "DOCX Upload";
}

export function ResumeTemplateList({ templates }: ResumeTemplateListProps) {
  const [isPending, startTransition] = useTransition();

  if (templates.length === 0) {
    return (
      <section className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-600 shadow-sm">
        Upload your resume (.docx) to create your first template.
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-2 shadow-sm">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-left text-slate-600">
            <tr>
              <th className="px-3 py-2 font-semibold">Name</th>
              <th className="px-3 py-2 font-semibold">Filename</th>
              <th className="px-3 py-2 font-semibold">Target Role</th>
              <th className="px-3 py-2 font-semibold">Source</th>
              <th className="px-3 py-2 font-semibold">Default</th>
              <th className="px-3 py-2 font-semibold">Upload Date</th>
              <th className="px-3 py-2 font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {templates.map((template) => (
              <tr key={template.id}>
                <td className="px-3 py-2 text-slate-900">{template.name}</td>
                <td className="px-3 py-2 text-slate-700">{template.originalFilename || "-"}</td>
                <td className="px-3 py-2 text-slate-700">{template.targetRole || "-"}</td>
                <td className="px-3 py-2">
                  <span className="rounded-full border border-slate-300 px-2 py-1 text-xs text-slate-700">
                    {sourceLabel(template.uploadSource)}
                  </span>
                </td>
                <td className="px-3 py-2 text-slate-700">{template.isDefault ? "Yes" : "No"}</td>
                <td className="px-3 py-2 text-slate-700">{formatDateTime(template.createdAt)}</td>
                <td className="px-3 py-2">
                  <div className="flex flex-wrap gap-2">
                    <Link
                      href={`/resumes/${template.id}`}
                      className="rounded-md border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100"
                    >
                      Manage
                    </Link>
                    {!template.isDefault ? (
                      <button
                        type="button"
                        disabled={isPending}
                        className="rounded-md border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-60"
                        onClick={() => {
                          startTransition(async () => {
                            await setDefaultResumeTemplate(template.id);
                          });
                        }}
                      >
                        Set default
                      </button>
                    ) : null}
                    <button
                      type="button"
                      disabled={isPending}
                      className="rounded-md border border-red-300 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-60"
                      onClick={() => {
                        if (!window.confirm("Delete this resume template?")) {
                          return;
                        }
                        startTransition(async () => {
                          await deleteResumeTemplate(template.id);
                        });
                      }}
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
