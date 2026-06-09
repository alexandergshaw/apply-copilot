// Supabase access for the job-fetcher worker.
//
// Uses the service role key for writes. This module must only ever run on a
// trusted server/worker environment — never in the browser.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "../../lib/supabase/types";
import type {
  JobBoardSourceType,
  JobSourceConfig,
  NormalizedJobPosting,
  UpsertSummary,
} from "./types";

export class WorkerConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WorkerConfigError";
  }
}

const SUPPORTED_SOURCE_TYPES: JobBoardSourceType[] = ["greenhouse", "lever", "ashby"];
const APPLY_URL_LOOKUP_BATCH_SIZE = 200;

export type WorkerSupabaseClient = SupabaseClient<Database>;

function chunkArray<T>(items: T[], size: number): T[][] {
  if (size <= 0) {
    return [items];
  }

  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

/**
 * Create a Supabase client authenticated with the service role key.
 * Throws WorkerConfigError when required environment variables are missing.
 */
export function createServiceClient(): WorkerSupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url) {
    throw new WorkerConfigError(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_URL environment variable.",
    );
  }
  if (!serviceRoleKey) {
    throw new WorkerConfigError("Missing SUPABASE_SERVICE_ROLE_KEY environment variable.");
  }

  return createClient<Database>(url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

function isSupportedSourceType(value: string): value is JobBoardSourceType {
  return (SUPPORTED_SOURCE_TYPES as string[]).includes(value);
}

type JobSourceConfigRow = {
  id: number;
  name: string;
  source_type: string;
  url: string;
  company_name: string | null;
  company_slug: string | null;
  last_run_at: string | null;
  fetch_interval_minutes: number | null;
  remote_only: boolean | null;
  posted_within_days: number | null;
  enabled: boolean | null;
};

function toConfig(row: JobSourceConfigRow): JobSourceConfig | null {
  if (!isSupportedSourceType(row.source_type)) {
    return null;
  }
  return {
    id: row.id,
    name: row.name,
    source_type: row.source_type,
    url: row.url,
    company_name: row.company_name,
    company_slug: row.company_slug,
    last_run_at: row.last_run_at,
    fetch_interval_minutes: row.fetch_interval_minutes,
    remote_only: row.remote_only ?? true,
    posted_within_days: row.posted_within_days ?? 1,
    enabled: row.enabled ?? false,
  };
}

const SOURCE_COLUMNS =
  "id, name, source_type, url, company_name, company_slug, last_run_at, fetch_interval_minutes, remote_only, posted_within_days, enabled";

/**
 * Load all enabled job sources whose source_type is a supported job board.
 */
export async function loadEnabledJobSources(
  client: WorkerSupabaseClient,
): Promise<JobSourceConfig[]> {
  const { data, error } = await client
    .from("job_sources")
    .select(SOURCE_COLUMNS)
    .eq("enabled", true)
    .in("source_type", SUPPORTED_SOURCE_TYPES)
    .order("id", { ascending: true });

  if (error) {
    throw new Error(`Failed to load job sources: ${error.message}`);
  }

  return (data ?? [])
    .map((row) => toConfig(row as JobSourceConfigRow))
    .filter((config): config is JobSourceConfig => config !== null);
}

/**
 * Load a single job source by id, returning null when it is missing or is not
 * a supported job board source type.
 */
export async function loadJobSourceById(
  client: WorkerSupabaseClient,
  id: number,
): Promise<JobSourceConfig | null> {
  const { data, error } = await client
    .from("job_sources")
    .select(SOURCE_COLUMNS)
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load job source ${id}: ${error.message}`);
  }
  if (!data) {
    return null;
  }

  return toConfig(data as JobSourceConfigRow);
}

/**
 * Insert/update normalized postings for a source, deduplicating on apply_url.
 *
 * - Postings missing a title or apply_url are skipped.
 * - Existing jobs (matched by apply_url) are updated without overwriting the
 *   user-controlled status field.
 * - New jobs are inserted with status 'found'.
 */
export async function upsertNormalizedJobs(
  client: WorkerSupabaseClient,
  source: JobSourceConfig,
  postings: NormalizedJobPosting[],
): Promise<UpsertSummary> {
  const summary: UpsertSummary = {
    jobsFound: postings.length,
    jobsInserted: 0,
    jobsUpdated: 0,
    jobsSkipped: 0,
  };

  const valid = postings.filter((posting) => {
    const hasTitle = typeof posting.title === "string" && posting.title.trim().length > 0;
    const hasUrl = typeof posting.apply_url === "string" && posting.apply_url.trim().length > 0;
    if (!hasTitle || !hasUrl) {
      summary.jobsSkipped += 1;
      return false;
    }
    return true;
  });

  if (valid.length === 0) {
    return summary;
  }

  const applyUrls = Array.from(new Set(valid.map((posting) => posting.apply_url)));

  const existingRows: Array<{ id: number; apply_url: string | null }> = [];
  const urlChunks = chunkArray(applyUrls, APPLY_URL_LOOKUP_BATCH_SIZE);

  for (const urlChunk of urlChunks) {
    const { data, error: selectError } = await client
      .from("jobs")
      .select("id, apply_url")
      .in("apply_url", urlChunk);

    if (selectError) {
      throw new Error(`Failed to query existing jobs: ${selectError.message}`);
    }

    existingRows.push(...(data ?? []));
  }

  const existingByUrl = new Map<string, number>();
  for (const row of existingRows) {
    if (row.apply_url) {
      existingByUrl.set(row.apply_url, row.id);
    }
  }

  const seen = new Set<string>();

  for (const posting of valid) {
    if (seen.has(posting.apply_url)) {
      // Duplicate within the same batch — apply_url is the dedupe key.
      summary.jobsSkipped += 1;
      continue;
    }
    seen.add(posting.apply_url);

    const existingId = existingByUrl.get(posting.apply_url);
    const nowIso = new Date().toISOString();

    if (existingId != null) {
      const { error: updateError } = await client
        .from("jobs")
        .update({
          title: posting.title,
          company: posting.company,
          location: posting.location,
          salary: posting.salary,
          description: posting.description,
          source_id: source.id,
          updated_at: nowIso,
        })
        .eq("id", existingId);

      if (updateError) {
        throw new Error(`Failed to update job ${existingId}: ${updateError.message}`);
      }
      summary.jobsUpdated += 1;
    } else {
      const { error: insertError } = await client.from("jobs").insert({
        source_id: source.id,
        title: posting.title,
        company: posting.company,
        location: posting.location,
        salary: posting.salary,
        description: posting.description,
        apply_url: posting.apply_url,
        status: "found",
      });

      if (insertError) {
        throw new Error(`Failed to insert job for ${posting.apply_url}: ${insertError.message}`);
      }
      summary.jobsInserted += 1;
    }
  }

  return summary;
}

/**
 * Create a job_fetch_runs row in the running state and return its id.
 */
export async function createFetchRun(
  client: WorkerSupabaseClient,
  source: JobSourceConfig,
): Promise<number> {
  const { data, error } = await client
    .from("job_fetch_runs")
    .insert({
      source_id: source.id,
      source_type: source.source_type,
      status: "running",
    })
    .select("id")
    .single();

  if (error || !data) {
    throw new Error(`Failed to create fetch run: ${error?.message ?? "unknown error"}`);
  }

  return data.id;
}

/**
 * Finalize a job_fetch_runs row with the final status, counts, and timing.
 */
export async function finishFetchRun(
  client: WorkerSupabaseClient,
  runId: number,
  status: "success" | "failed" | "partial",
  summary: UpsertSummary,
  errorMessage: string | null,
): Promise<void> {
  const { error } = await client
    .from("job_fetch_runs")
    .update({
      status,
      jobs_found: summary.jobsFound,
      jobs_inserted: summary.jobsInserted,
      jobs_updated: summary.jobsUpdated,
      jobs_skipped: summary.jobsSkipped,
      error_message: errorMessage,
      finished_at: new Date().toISOString(),
    })
    .eq("id", runId);

  if (error) {
    throw new Error(`Failed to finish fetch run ${runId}: ${error.message}`);
  }
}

/**
 * Update the source's run bookkeeping after a fetch attempt.
 */
export async function updateSourceAfterRun(
  client: WorkerSupabaseClient,
  source: JobSourceConfig,
  success: boolean,
  errorMessage: string | null,
): Promise<void> {
  const { data: current } = await client
    .from("job_sources")
    .select("run_count")
    .eq("id", source.id)
    .maybeSingle();

  const nowIso = new Date().toISOString();
  const update: Database["public"]["Tables"]["job_sources"]["Update"] = {
    last_run_at: nowIso,
    run_count: (current?.run_count ?? 0) + 1,
    last_error: success ? null : errorMessage,
  };
  if (success) {
    update.last_success_at = nowIso;
  }

  const { error } = await client.from("job_sources").update(update).eq("id", source.id);
  if (error) {
    throw new Error(`Failed to update source ${source.id}: ${error.message}`);
  }
}
