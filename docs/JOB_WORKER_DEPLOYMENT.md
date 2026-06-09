# Job Worker Deployment

The job-fetcher worker pulls postings from configured job board sources
(Greenhouse, Lever, Ashby), normalizes them, deduplicates by `apply_url`, and
inserts/updates rows in the `jobs` table. Because the jobs page reads directly
from `jobs`, fetched roles appear on `/jobs` automatically after each run.

## Required environment variables

| Variable | Required | Notes |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` or `SUPABASE_URL` | Yes | Supabase project URL. |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Service role key. **Server/worker only — never expose to the browser.** |
| `DEFAULT_FETCH_INTERVAL_MINUTES` | No | Default per-source cadence in minutes when a source has no override. Default: `10`. |
| `JOB_FETCH_SCAN_INTERVAL_MS` | No | Continuous mode scan cadence. Default: `60000` (1m). Sources still run only when due. |
| `JOB_FETCH_INTERVAL_MS` | No | Legacy continuous mode env (still supported as fallback to `JOB_FETCH_SCAN_INTERVAL_MS`). |

> The worker writes with the service role key so it can bypass RLS. Never use
> the anon key for worker writes, and never ship the service role key to client
> bundles.

## Commands

Run once (recommended for cron/scheduled jobs):

```bash
npm run worker:jobs:once
```

Run continuously (long-lived process that re-runs on an interval):

```bash
npm run worker:jobs
```

Continuous mode runs a frequent scan loop; each source still obeys due-time
rules based on `fetch_interval_minutes` (or `DEFAULT_FETCH_INTERVAL_MINUTES`).

Exit codes (one-shot `--once` mode):

- `0` — completed; some or all sources succeeded, or there were no enabled
  sources to process.
- `1` — every processed source failed, or a fatal configuration error occurred
  (e.g. missing `SUPABASE_SERVICE_ROLE_KEY`).

## Railway deployment

1. Create a new service in Railway from this repository.
2. Add the environment variables listed above.
3. Configure the start command for a **scheduled** (cron) service:

   ```bash
   npm run worker:jobs:once
   ```

4. Set a cron schedule, for example every 10 minutes:

   ```cron
  */10 * * * *
   ```

   Railway will start the service on that schedule, run a single fetch pass, and
   exit. Each run records a row in `job_fetch_runs` and updates `last_run_at`,
   `last_success_at`, `last_error`, and `run_count` on the corresponding
   `job_sources` row.

   Alternatively, deploy a long-running worker service that uses
   `npm run worker:jobs`, controls scan cadence via
   `JOB_FETCH_SCAN_INTERVAL_MS`, and controls fetch cadence with
   per-source `fetch_interval_minutes` (or `DEFAULT_FETCH_INTERVAL_MINUTES`).

## Cadence examples

- Default every 10 minutes for all sources:
  - `DEFAULT_FETCH_INTERVAL_MINUTES=10`
  - `fetch_interval_minutes = NULL` on each source
- Run one source hourly:
  - set that source row `fetch_interval_minutes = 60`
- Run one source every 15 minutes:
  - set that source row `fetch_interval_minutes = 15`

## After a run

- New jobs are inserted with `status = 'found'` and become visible on `/jobs`.
- Existing jobs (matched by `apply_url`) are updated in place; the user-managed
  `status` field is never overwritten.
- Per-source results are visible on the `/sources` admin page, including last
  run/success timestamps, run count, and the last error message.
- You can trigger an ad-hoc fetch for a single source from `/sources` using the
  **Run Fetch Now** button.
