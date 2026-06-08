"use client";

import { useMemo, useState } from "react";

import { JobCard } from "@/components/JobCard";
import { JobFilters, type JobFilterState } from "@/components/JobFilters";
import { jobs } from "@/lib/mock-data";

const initialFilters: JobFilterState = {
  status: "all",
  source: "all",
  minMatchScore: 0,
  search: "",
};

export default function JobsPage() {
  const [filters, setFilters] = useState<JobFilterState>(initialFilters);

  const sources = useMemo(() => Array.from(new Set(jobs.map((job) => job.source))), []);

  const filteredJobs = useMemo(() => {
    const normalizedSearch = filters.search.trim().toLowerCase();

    return jobs.filter((job) => {
      if (filters.status !== "all" && job.status !== filters.status) {
        return false;
      }

      if (filters.source !== "all" && job.source !== filters.source) {
        return false;
      }

      if (job.matchScore < filters.minMatchScore) {
        return false;
      }

      if (!normalizedSearch) {
        return true;
      }

      return [job.company, job.role, job.description].some((value) =>
        value.toLowerCase().includes(normalizedSearch),
      );
    });
  }, [filters]);

  return (
    <section className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Jobs</h1>
        <p className="text-slate-600">Review opportunities and prioritize the highest-fit roles.</p>
      </div>

      <JobFilters filters={filters} sources={sources} onChange={setFilters} />

      <div className="space-y-4">
        {filteredJobs.length > 0 ? (
          filteredJobs.map((job) => <JobCard key={job.id} job={job} />)
        ) : (
          <p className="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-600">
            No jobs match the selected filters.
          </p>
        )}
      </div>
    </section>
  );
}
