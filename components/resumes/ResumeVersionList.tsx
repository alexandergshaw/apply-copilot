"use client";

import Link from "next/link";
import { useTransition } from "react";

import { deleteResumeVersion, setDefaultResumeVersion } from "@/app/resumes/actions";
import type { ResumeVersion } from "@/lib/supabase/types";

type ResumeVersionListProps = {
  resumes: ResumeVersion[];
};

function formatDateTime(value: string): string {
  if (!value) {
    return "-";
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

export function ResumeVersionList({ resumes }: ResumeVersionListProps) {
  const [isPending, startTransition] = useTransition();

  if (resumes.length === 0) {
    return (
      <section className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-600 shadow-sm">
        No resume versions yet. Create your first resume version below.
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
              <th className="px-3 py-2 font-semibold">Target Role</th>
              <th className="px-3 py-2 font-semibold">Default</th>
              <th className="px-3 py-2 font-semibold">Created</th>
              <th className="px-3 py-2 font-semibold">Updated</th>
              <th className="px-3 py-2 font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {resumes.map((resume) => (
              <tr key={resume.id}>
                <td className="px-3 py-2 text-slate-900">{resume.name}</td>
                <td className="px-3 py-2 text-slate-700">{resume.targetRole || "-"}</td>
                <td className="px-3 py-2 text-slate-700">{resume.isDefault ? "Yes" : "No"}</td>
                <td className="px-3 py-2 text-slate-700">{formatDateTime(resume.createdAt)}</td>
                <td className="px-3 py-2 text-slate-700">{formatDateTime(resume.updatedAt)}</td>
                <td className="px-3 py-2">
                  <div className="flex flex-wrap gap-2">
                    <Link
                      className="rounded-md border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100"
                      href={`/resumes/${resume.id}`}
                    >
                      Edit
                    </Link>
                    {!resume.isDefault ? (
                      <button
                        className="rounded-md border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-60"
                        type="button"
                        disabled={isPending}
                        onClick={() => {
                          startTransition(async () => {
                            await setDefaultResumeVersion(resume.id);
                          });
                        }}
                      >
                        Set default
                      </button>
                    ) : null}
                    <button
                      className="rounded-md border border-red-300 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-60"
                      type="button"
                      disabled={isPending}
                      onClick={() => {
                        if (!window.confirm("Delete this resume version?")) {
                          return;
                        }

                        startTransition(async () => {
                          await deleteResumeVersion(resume.id);
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
