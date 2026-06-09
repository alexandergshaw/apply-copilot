"use client";

import { useMemo, useState } from "react";

import { JobCard } from "@/components/JobCard";
import { JobFilters, type JobFilterState } from "@/components/JobFilters";
import type { Job } from "@/lib/mock-data";

const initialFilters: JobFilterState = {
  status: "all",
  source: "all",
  sourceType: "all",
  minMatchScore: 0,
  search: "",
};

type JobsBrowserProps = {
  jobs: Job[];
};

export function JobsBrowser({ jobs }: JobsBrowserProps) {
  const [filters, setFilters] = useState<JobFilterState>(initialFilters);

  const sources = useMemo(
    () => Array.from(new Set(jobs.map((job) => job.source).filter(Boolean))),
    [jobs],
  );

  const sourceTypes = useMemo(
    () => Array.from(new Set(jobs.map((job) => job.sourceType).filter(Boolean))),
    [jobs],
  );

  const filteredJobs = useMemo(() => {
    const normalizedSearch = filters.search.trim().toLowerCase();

    return jobs.filter((job) => {
      if (filters.status !== "all" && job.status !== filters.status) {
        return false;
      }

      if (filters.source !== "all" && job.source !== filters.source) {
        return false;
      }

      if (filters.sourceType !== "all" && job.sourceType !== filters.sourceType) {
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
  }, [filters, jobs]);

  return (
    <>
      <JobFilters filters={filters} sources={sources} sourceTypes={sourceTypes} onChange={setFilters} />

      <div className="space-y-4">
        {filteredJobs.length > 0 ? (
          filteredJobs.map((job) => <JobCard key={job.id} job={job} />)
        ) : (
          <p className="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-600">
            No jobs match the selected filters.
          </p>
        )}
      </div>
    </>
  );
}
