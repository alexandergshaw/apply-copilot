-- Job board worker infrastructure.
--
-- Adds source metadata/run tracking columns to job_sources, creates the
-- job_fetch_runs audit table, and adds supporting indexes used by the
-- worker that fetches jobs from greenhouse/lever/ashby job boards.

-- Ensure updated_at trigger function exists.
create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- 1. Extend job_sources with worker metadata.
alter table job_sources
  add column if not exists company_name text,
  add column if not exists company_slug text,
  add column if not exists last_run_at timestamptz,
  add column if not exists last_success_at timestamptz,
  add column if not exists last_error text,
  add column if not exists run_count integer not null default 0;

-- 2. job_fetch_runs audit table.
create table if not exists job_fetch_runs (
  id bigint generated always as identity primary key,
  source_id bigint references job_sources(id) on delete cascade,
  source_type text not null,
  status text default 'running',
  jobs_found integer default 0,
  jobs_inserted integer default 0,
  jobs_updated integer default 0,
  jobs_skipped integer default 0,
  error_message text,
  started_at timestamptz default now(),
  finished_at timestamptz,
  created_at timestamptz default now()
);

alter table job_fetch_runs drop constraint if exists chk_job_fetch_runs_status;

alter table job_fetch_runs
  add constraint chk_job_fetch_runs_status
  check (status in ('running', 'success', 'failed', 'partial'));

-- 3. Indexes.
create index if not exists idx_job_sources_enabled on job_sources(enabled);
create index if not exists idx_job_sources_source_type on job_sources(source_type);
create index if not exists idx_job_fetch_runs_source_id on job_fetch_runs(source_id);
create index if not exists idx_job_fetch_runs_status on job_fetch_runs(status);
create index if not exists idx_jobs_apply_url on jobs(apply_url);
create index if not exists idx_jobs_source_id on jobs(source_id);
