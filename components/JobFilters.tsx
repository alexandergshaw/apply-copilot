"use client";

import type { JobStatus } from "@/lib/mock-data";

export type JobFilterState = {
  status: "all" | JobStatus;
  source: "all" | string;
  minMatchScore: number;
  search: string;
};

type JobFiltersProps = {
  filters: JobFilterState;
  sources: string[];
  onChange: (filters: JobFilterState) => void;
};

export function JobFilters({ filters, sources, onChange }: JobFiltersProps) {
  return (
    <section className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-4">
      <label className="text-sm text-slate-700">
        <span className="mb-1 block font-medium">Status</span>
        <select
          className="w-full rounded-md border border-slate-300 bg-white px-3 py-2"
          value={filters.status}
          onChange={(event) => onChange({ ...filters, status: event.target.value as JobFilterState["status"] })}
        >
          <option value="all">All</option>
          <option value="new">New</option>
          <option value="review">Review</option>
          <option value="applied">Applied</option>
          <option value="rejected">Rejected</option>
        </select>
      </label>

      <label className="text-sm text-slate-700">
        <span className="mb-1 block font-medium">Source</span>
        <select
          className="w-full rounded-md border border-slate-300 bg-white px-3 py-2"
          value={filters.source}
          onChange={(event) => onChange({ ...filters, source: event.target.value })}
        >
          <option value="all">All</option>
          {sources.map((source) => (
            <option key={source} value={source}>
              {source}
            </option>
          ))}
        </select>
      </label>

      <label className="text-sm text-slate-700">
        <span className="mb-1 block font-medium">Min match score</span>
        <input
          className="w-full rounded-md border border-slate-300 bg-white px-3 py-2"
          min={0}
          max={100}
          type="number"
          value={filters.minMatchScore}
          onChange={(event) => onChange({ ...filters, minMatchScore: Number(event.target.value) || 0 })}
        />
      </label>

      <label className="text-sm text-slate-700">
        <span className="mb-1 block font-medium">Search</span>
        <input
          className="w-full rounded-md border border-slate-300 bg-white px-3 py-2"
          placeholder="Company, role, or keyword"
          type="search"
          value={filters.search}
          onChange={(event) => onChange({ ...filters, search: event.target.value })}
        />
      </label>
    </section>
  );
}
