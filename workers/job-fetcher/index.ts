// CLI entrypoint for the job-fetcher worker.
//
// Usage:
//   tsx workers/job-fetcher/index.ts          # continuous mode (loops)
//   tsx workers/job-fetcher/index.ts --once    # single pass, then exit

import { fetchAllEnabledJobSources } from "./fetch-all";
import { WorkerConfigError } from "./supabase";

const DEFAULT_INTERVAL_MS = 6 * 60 * 60 * 1000; // 6 hours
const MIN_INTERVAL_MS = 60 * 1000; // 1 minute

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function resolveIntervalMs(): number {
  const raw = process.env.JOB_FETCH_INTERVAL_MS;
  if (!raw) {
    return DEFAULT_INTERVAL_MS;
  }
  const parsed = Number.parseInt(raw, 10);
  if (Number.isNaN(parsed) || parsed < MIN_INTERVAL_MS) {
    return DEFAULT_INTERVAL_MS;
  }
  return parsed;
}

async function main(): Promise<void> {
  const runOnce = process.argv.includes("--once");

  // First pass runs directly so that fatal configuration errors propagate.
  const first = await fetchAllEnabledJobSources();

  if (runOnce) {
    // Treat "all sources failed" as a failure; no sources is a success.
    const allFailed = first.processed > 0 && first.succeeded === 0;
    process.exit(allFailed ? 1 : 0);
  }

  const intervalMs = resolveIntervalMs();
  console.log(`[job-fetcher] Continuous mode enabled. Re-running every ${intervalMs} ms.`);

  setInterval(() => {
    fetchAllEnabledJobSources().catch((error) => {
      console.error(`[job-fetcher] Scheduled run failed: ${describeError(error)}`);
    });
  }, intervalMs);
}

main().catch((error) => {
  if (error instanceof WorkerConfigError) {
    console.error(`[job-fetcher] Configuration error: ${error.message}`);
  } else {
    console.error(`[job-fetcher] Fatal error: ${describeError(error)}`);
  }
  process.exit(1);
});
