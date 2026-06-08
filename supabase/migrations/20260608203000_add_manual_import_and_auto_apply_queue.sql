-- Manual import and auto-apply approval queue support.

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

alter table jobs
  add column if not exists auto_apply_enabled boolean not null default false,
  add column if not exists auto_apply_approved_at timestamptz,
  add column if not exists auto_apply_status text not null default 'not_requested',
  add column if not exists auto_apply_error text;

alter table jobs drop constraint if exists chk_jobs_auto_apply_status;

alter table jobs
  add constraint chk_jobs_auto_apply_status
  check (auto_apply_status in (
    'not_requested',
    'queued',
    'running',
    'needs_review',
    'submitted',
    'failed',
    'blocked',
    'canceled'
  ));

create table if not exists auto_apply_runs (
  id bigint generated always as identity primary key,
  job_id bigint references jobs(id) on delete cascade,
  status text not null default 'queued',
  started_at timestamptz,
  finished_at timestamptz,
  error_message text,
  run_log jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_jobs_auto_apply_status on jobs(auto_apply_status);
create index if not exists idx_jobs_auto_apply_enabled on jobs(auto_apply_enabled);
create index if not exists idx_auto_apply_runs_job_id on auto_apply_runs(job_id);
create index if not exists idx_auto_apply_runs_status on auto_apply_runs(status);

drop trigger if exists trg_auto_apply_runs_updated_at on auto_apply_runs;

create trigger trg_auto_apply_runs_updated_at
  before update on auto_apply_runs
  for each row execute function set_updated_at();
