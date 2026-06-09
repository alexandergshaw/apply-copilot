// Orchestration for fetching jobs from all enabled job board sources.

import { fetchAshbyJobs } from "./providers/ashby";
import { fetchGreenhouseJobs } from "./providers/greenhouse";
import { fetchLeverJobs } from "./providers/lever";
import {
  getEffectiveFetchIntervalMinutes,
  getNextDueAt,
  isSourceDue,
  resolveDefaultFetchIntervalMinutes,
} from "./scheduling";
import {
  createFetchRun,
  createServiceClient,
  finishFetchRun,
  loadEnabledJobSources,
  loadJobSourceById,
  updateSourceAfterRun,
  upsertNormalizedJobs,
  type WorkerSupabaseClient,
} from "./supabase";
import type { JobSourceConfig, NormalizedJobPosting, SourceRunResult, UpsertSummary } from "./types";

const EMPTY_SUMMARY: UpsertSummary = {
  jobsFound: 0,
  jobsInserted: 0,
  jobsUpdated: 0,
  jobsSkipped: 0,
};

export type FetchAllResult = {
  processed: number;
  succeeded: number;
  failed: number;
  results: SourceRunResult[];
};

function fetchPostingsForSource(source: JobSourceConfig): Promise<NormalizedJobPosting[]> {
  switch (source.source_type) {
    case "greenhouse":
      return fetchGreenhouseJobs(source);
    case "lever":
      return fetchLeverJobs(source);
    case "ashby":
      return fetchAshbyJobs(source);
    default:
      return Promise.reject(
        new Error(`Unsupported source type "${source.source_type}" for source "${source.name}".`),
      );
  }
}

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Process a single source: record a run, fetch + upsert jobs, and update
 * bookkeeping. Never throws — failures are captured in the returned result.
 */
export async function processSource(
  client: WorkerSupabaseClient,
  source: JobSourceConfig,
): Promise<SourceRunResult> {
  let runId: number | null = null;
  try {
    runId = await createFetchRun(client, source);
  } catch (error) {
    // If we cannot even record the run, report a failure for this source.
    return {
      sourceId: source.id,
      sourceName: source.name,
      sourceType: source.source_type,
      status: "failed",
      summary: { ...EMPTY_SUMMARY },
      error: describeError(error),
    };
  }

  try {
    const postings = await fetchPostingsForSource(source);
    const summary = await upsertNormalizedJobs(client, source, postings);
    await finishFetchRun(client, runId, "success", summary, null);
    await updateSourceAfterRun(client, source, true, null);
    return {
      sourceId: source.id,
      sourceName: source.name,
      sourceType: source.source_type,
      status: "success",
      summary,
    };
  } catch (error) {
    const message = describeError(error);
    // Best-effort cleanup; swallow secondary failures.
    try {
      await finishFetchRun(client, runId, "failed", { ...EMPTY_SUMMARY }, message);
    } catch {
      /* ignore */
    }
    try {
      await updateSourceAfterRun(client, source, false, message);
    } catch {
      /* ignore */
    }
    return {
      sourceId: source.id,
      sourceName: source.name,
      sourceType: source.source_type,
      status: "failed",
      summary: { ...EMPTY_SUMMARY },
      error: message,
    };
  }
}

function logResult(result: SourceRunResult): void {
  if (result.status === "success") {
    const { jobsFound, jobsInserted, jobsUpdated, jobsSkipped } = result.summary;
    console.log(
      `[job-fetcher] ${result.sourceName} (${result.sourceType}): ` +
        `found ${jobsFound}, inserted ${jobsInserted}, updated ${jobsUpdated}, skipped ${jobsSkipped}`,
    );
  } else {
    console.error(
      `[job-fetcher] ${result.sourceName} (${result.sourceType}) failed: ${result.error}`,
    );
  }
}

/**
 * Fetch jobs from every enabled, supported job board source.
 */
export async function fetchAllEnabledJobSources(): Promise<FetchAllResult> {
  const client = createServiceClient();
  const sources = await loadEnabledJobSources(client);
  const defaultFetchIntervalMinutes = resolveDefaultFetchIntervalMinutes();
  const now = new Date();

  if (sources.length === 0) {
    console.log("[job-fetcher] No enabled job board sources to process.");
    return { processed: 0, succeeded: 0, failed: 0, results: [] };
  }

  const dueSources = sources.filter((source) =>
    isSourceDue(source, now, defaultFetchIntervalMinutes),
  );
  const notDueSources = sources.filter(
    (source) => !isSourceDue(source, now, defaultFetchIntervalMinutes),
  );

  console.log(
    `[job-fetcher] ${dueSources.length} source(s) due, ${notDueSources.length} source(s) skipped (not due).`,
  );

  for (const source of notDueSources) {
    const effectiveMinutes = getEffectiveFetchIntervalMinutes(
      source,
      defaultFetchIntervalMinutes,
    );
    const nextDueAt = getNextDueAt(source, now, defaultFetchIntervalMinutes);
    console.log(
      `[job-fetcher] Skipping ${source.name} (${source.source_type}) until ` +
        `${nextDueAt ? nextDueAt.toISOString() : "next run"} ` +
        `(interval ${effectiveMinutes}m).`,
    );
  }

  if (dueSources.length === 0) {
    return { processed: 0, succeeded: 0, failed: 0, results: [] };
  }

  console.log(`[job-fetcher] Processing ${dueSources.length} due source(s)...`);

  const results: SourceRunResult[] = [];
  for (const source of dueSources) {
    const result = await processSource(client, source);
    logResult(result);
    results.push(result);
  }

  const succeeded = results.filter((result) => result.status === "success").length;
  const failed = results.length - succeeded;

  console.log(
    `[job-fetcher] Done. ${succeeded} succeeded, ${failed} failed of ${results.length} source(s).`,
  );

  return { processed: results.length, succeeded, failed, results };
}

/**
 * Fetch jobs for a single source by id. Used by the admin "Run Fetch Now"
 * action. Throws when the source does not exist or is not a supported type.
 */
export async function fetchJobsForSourceId(sourceId: number): Promise<SourceRunResult> {
  const client = createServiceClient();
  const source = await loadJobSourceById(client, sourceId);

  if (!source) {
    throw new Error(
      `Source ${sourceId} was not found or is not a supported job board source type.`,
    );
  }

  const result = await processSource(client, source);
  logResult(result);
  return result;
}
