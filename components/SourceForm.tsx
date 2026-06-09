"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

import {
  applyDefaultFiltersToAllJobSources,
  createJobSource,
  deleteJobSource,
  runJobFetchForSource,
  updateJobSource,
  type ActionResult,
} from "@/lib/actions";
import type { JobSource, SourceType } from "@/lib/mock-data";

type SourceFormProps = {
  initialSources: JobSource[];
};

type SourceDraft = {
  id: string;
  sourceName: string;
  sourceType: SourceType;
  url: string;
  companyName: string;
  companySlug: string;
  fetchIntervalMinutes: string;
  remoteOnly: boolean;
  postedWithinDays: string;
  enabled: boolean;
};

const DEFAULT_FETCH_INTERVAL_MINUTES = 10;

const emptySource: SourceDraft = {
  id: "",
  sourceName: "",
  sourceType: "greenhouse",
  url: "",
  companyName: "",
  companySlug: "",
  fetchIntervalMinutes: "",
  remoteOnly: true,
  postedWithinDays: "1",
  enabled: true,
};

const SOURCE_TYPE_OPTIONS: { value: SourceType; label: string }[] = [
  { value: "greenhouse", label: "Greenhouse" },
  { value: "lever", label: "Lever" },
  { value: "ashby", label: "Ashby" },
  { value: "manual", label: "Manual" },
  { value: "url", label: "URL" },
];

function formatTimestamp(value: string): string {
  if (!value) {
    return "—";
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function formatIntervalLabel(value: number | null): string {
  if (value == null) {
    return `Default (${DEFAULT_FETCH_INTERVAL_MINUTES}m)`;
  }
  return `${value}m`;
}

function formatNextRunDue(
  lastAutoRunAt: string,
  lastRunAt: string,
  fetchIntervalMinutes: number | null,
  now: Date,
): string {
  const referenceRunAt = lastAutoRunAt || lastRunAt;
  if (!referenceRunAt) {
    return "Now";
  }

  const lastRun = new Date(referenceRunAt);
  if (Number.isNaN(lastRun.getTime())) {
    return "Now";
  }

  const intervalMinutes = fetchIntervalMinutes ?? DEFAULT_FETCH_INTERVAL_MINUTES;
  const nextDue = new Date(lastRun.getTime() + intervalMinutes * 60 * 1000);
  if (nextDue.getTime() <= now.getTime()) {
    return "Now";
  }

  return nextDue.toLocaleString();
}

export function SourceForm({ initialSources }: SourceFormProps) {
  const router = useRouter();
  const [draft, setDraft] = useState<SourceDraft>(emptySource);
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setNow(new Date());
    }, 30_000);

    return () => window.clearInterval(intervalId);
  }, []);

  const runAction = (
    action: () => Promise<ActionResult>,
    onSuccess?: () => void,
    showSuccessMessage = false,
  ) => {
    setMessage(null);
    setIsError(false);
    startTransition(async () => {
      const result = await action();
      if (result.ok) {
        onSuccess?.();
        if (showSuccessMessage && result.message) {
          setMessage(result.message);
          setIsError(false);
        }
        router.refresh();
      } else if (result.message) {
        setMessage(result.message);
        setIsError(true);
      }
    });
  };

  const saveSource = () => {
    if (!draft.sourceName.trim() || !draft.url.trim()) {
      return;
    }

    const input = {
      sourceName: draft.sourceName,
      sourceType: draft.sourceType,
      url: draft.url,
      companyName: draft.companyName,
      companySlug: draft.companySlug,
      fetchIntervalMinutes: draft.fetchIntervalMinutes,
      remoteOnly: draft.remoteOnly,
      postedWithinDays: draft.postedWithinDays,
      enabled: draft.enabled,
    };

    runAction(
      () => (draft.id ? updateJobSource(draft.id, input) : createJobSource(input)),
      () => setDraft(emptySource),
    );
  };

  const editSource = (source: JobSource) => {
    setDraft({
      id: source.id,
      sourceName: source.sourceName,
      sourceType: source.sourceType,
      url: source.url,
      companyName: source.companyName,
      companySlug: source.companySlug,
      fetchIntervalMinutes:
        source.fetchIntervalMinutes != null ? String(source.fetchIntervalMinutes) : "",
      remoteOnly: source.remoteOnly,
      postedWithinDays: String(source.postedWithinDays),
      enabled: source.enabled,
    });
  };

  const removeSource = (id: string) => {
    runAction(
      () => deleteJobSource(id),
      () => {
        if (draft.id === id) {
          setDraft(emptySource);
        }
      },
    );
  };

  const runFetch = (id: string) => {
    runAction(() => runJobFetchForSource(id), undefined, true);
  };

  const applyDefaultsToAllSources = () => {
    runAction(() => applyDefaultFiltersToAllJobSources(), undefined, true);
  };

  return (
    <section className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Source details</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <label className="text-sm text-slate-700">
            <span className="mb-1 block font-medium">Source name</span>
            <input
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2"
              type="text"
              value={draft.sourceName}
              onChange={(event) => setDraft({ ...draft, sourceName: event.target.value })}
            />
          </label>

          <label className="text-sm text-slate-700">
            <span className="mb-1 block font-medium">Source type</span>
            <select
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2"
              value={draft.sourceType}
              onChange={(event) =>
                setDraft({ ...draft, sourceType: event.target.value as SourceType })
              }
            >
              {SOURCE_TYPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="text-sm text-slate-700">
            <span className="mb-1 block font-medium">Company name</span>
            <input
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2"
              type="text"
              value={draft.companyName}
              onChange={(event) => setDraft({ ...draft, companyName: event.target.value })}
            />
          </label>

          <label className="text-sm text-slate-700">
            <span className="mb-1 block font-medium">Company slug</span>
            <input
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2"
              type="text"
              placeholder="e.g. example (board identifier)"
              value={draft.companySlug}
              onChange={(event) => setDraft({ ...draft, companySlug: event.target.value })}
            />
          </label>

          <label className="text-sm text-slate-700 md:col-span-2">
            <span className="mb-1 block font-medium">URL</span>
            <input
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2"
              type="url"
              value={draft.url}
              onChange={(event) => setDraft({ ...draft, url: event.target.value })}
            />
          </label>

          <label className="text-sm text-slate-700">
            <span className="mb-1 block font-medium">Fetch interval (minutes)</span>
            <input
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2"
              type="number"
              min={1}
              placeholder={`Default (${DEFAULT_FETCH_INTERVAL_MINUTES})`}
              value={draft.fetchIntervalMinutes}
              onChange={(event) =>
                setDraft({ ...draft, fetchIntervalMinutes: event.target.value })
              }
            />
            <span className="mt-1 block text-xs text-slate-500">
              Leave blank to use the default cadence.
            </span>
          </label>

          <label className="inline-flex items-center gap-2 text-sm font-medium text-slate-700">
            <input
              checked={draft.remoteOnly}
              type="checkbox"
              onChange={(event) => setDraft({ ...draft, remoteOnly: event.target.checked })}
            />
            Remote jobs only
          </label>

          <label className="text-sm text-slate-700">
            <span className="mb-1 block font-medium">Posted within days</span>
            <input
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2"
              type="number"
              min={1}
              value={draft.postedWithinDays}
              onChange={(event) => setDraft({ ...draft, postedWithinDays: event.target.value })}
            />
            <span className="mt-1 block text-xs text-slate-500">
              Jobs missing posted date are skipped when this filter is set.
            </span>
          </label>

          <label className="inline-flex items-center gap-2 text-sm font-medium text-slate-700">
            <input
              checked={draft.enabled}
              type="checkbox"
              onChange={(event) => setDraft({ ...draft, enabled: event.target.checked })}
            />
            Enabled
          </label>
        </div>

        <div className="mt-4 flex gap-2">
          <button
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-60"
            type="button"
            disabled={isPending}
            onClick={saveSource}
          >
            {draft.id ? "Update source" : "Add source"}
          </button>
          <button
            className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700"
            type="button"
            onClick={() => setDraft(emptySource)}
          >
            Clear
          </button>
          <button
            className="rounded-md border border-indigo-300 px-4 py-2 text-sm font-medium text-indigo-700 disabled:opacity-60"
            type="button"
            disabled={isPending}
            onClick={applyDefaultsToAllSources}
          >
            Apply defaults to all sources
          </button>
        </div>
        {message ? (
          <p className={`mt-3 text-sm ${isError ? "text-amber-700" : "text-emerald-700"}`}>
            {message}
          </p>
        ) : null}
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-left text-slate-600">
            <tr>
              <th className="px-4 py-3 font-semibold">Source name</th>
              <th className="px-4 py-3 font-semibold">Type</th>
              <th className="px-4 py-3 font-semibold">Slug</th>
              <th className="px-4 py-3 font-semibold">Interval</th>
              <th className="px-4 py-3 font-semibold">Remote only</th>
              <th className="px-4 py-3 font-semibold">Posted within</th>
              <th className="px-4 py-3 font-semibold">Next due</th>
              <th className="px-4 py-3 font-semibold">Enabled</th>
              <th className="px-4 py-3 font-semibold">Last run</th>
              <th className="px-4 py-3 font-semibold">Last auto run</th>
              <th className="px-4 py-3 font-semibold">Last success</th>
              <th className="px-4 py-3 font-semibold">Runs</th>
              <th className="px-4 py-3 font-semibold">Last error</th>
              <th className="px-4 py-3 font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {initialSources.map((source) => {
              const canFetch = ["greenhouse", "lever", "ashby"].includes(source.sourceType);
              return (
                <tr key={source.id}>
                  <td className="px-4 py-3 font-medium text-slate-900">{source.sourceName}</td>
                  <td className="px-4 py-3 capitalize text-slate-700">{source.sourceType}</td>
                  <td className="px-4 py-3 text-slate-700">{source.companySlug || "—"}</td>
                  <td className="px-4 py-3 text-slate-700">
                    {formatIntervalLabel(source.fetchIntervalMinutes)}
                  </td>
                  <td className="px-4 py-3 text-slate-700">{source.remoteOnly ? "Yes" : "No"}</td>
                  <td className="px-4 py-3 text-slate-700">{source.postedWithinDays} day(s)</td>
                  <td className="px-4 py-3 text-slate-700">
                    {formatNextRunDue(
                      source.lastAutoRunAt,
                      source.lastRunAt,
                      source.fetchIntervalMinutes,
                      now,
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-700">{source.enabled ? "Yes" : "No"}</td>
                  <td className="px-4 py-3 text-slate-700">{formatTimestamp(source.lastRunAt)}</td>
                  <td className="px-4 py-3 text-slate-700">
                    {formatTimestamp(source.lastAutoRunAt)}
                  </td>
                  <td className="px-4 py-3 text-slate-700">
                    {formatTimestamp(source.lastSuccessAt)}
                  </td>
                  <td className="px-4 py-3 text-slate-700">{source.runCount}</td>
                  <td className="px-4 py-3 text-red-700">{source.lastError || "—"}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-2">
                      {canFetch ? (
                        <button
                          className="rounded-md border border-emerald-300 px-3 py-1.5 text-xs font-medium text-emerald-700 disabled:opacity-60"
                          type="button"
                          disabled={isPending}
                          onClick={() => runFetch(source.id)}
                        >
                          Run Fetch Now
                        </button>
                      ) : null}
                      <button
                        className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700"
                        type="button"
                        onClick={() => editSource(source)}
                      >
                        Edit
                      </button>
                      <button
                        className="rounded-md border border-red-200 px-3 py-1.5 text-xs font-medium text-red-700 disabled:opacity-60"
                        type="button"
                        disabled={isPending}
                        onClick={() => removeSource(source.id)}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
