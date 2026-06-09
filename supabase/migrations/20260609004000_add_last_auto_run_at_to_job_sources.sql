-- Track the last successful automatic worker run per source.

alter table job_sources
  add column if not exists last_auto_run_at timestamptz;

create index if not exists idx_job_sources_last_auto_run_at on job_sources(last_auto_run_at);
