// Shared types for the job-fetcher worker.

export type JobBoardSourceType = "greenhouse" | "lever" | "ashby";

/**
 * Configuration describing a single job board source to fetch from.
 * Mirrors the relevant columns of the `job_sources` table.
 */
export type JobSourceConfig = {
  id: number;
  name: string;
  source_type: JobBoardSourceType;
  url: string;
  company_name: string | null;
  company_slug: string | null;
  last_run_at: string | null;
  fetch_interval_minutes: number | null;
  enabled: boolean;
};

/**
 * A job posting normalized into the shape used by the `jobs` table.
 */
export type NormalizedJobPosting = {
  title: string;
  company: string | null;
  location: string | null;
  salary: string | null;
  description: string | null;
  apply_url: string;
  source_job_id: string | null;
  raw: unknown;
};

/**
 * Result of upserting a batch of normalized postings for a source.
 */
export type UpsertSummary = {
  jobsFound: number;
  jobsInserted: number;
  jobsUpdated: number;
  jobsSkipped: number;
};

/**
 * Outcome of processing a single source during a fetch run.
 */
export type SourceRunResult = {
  sourceId: number;
  sourceName: string;
  sourceType: JobBoardSourceType;
  status: "success" | "failed";
  summary: UpsertSummary;
  error?: string;
};
