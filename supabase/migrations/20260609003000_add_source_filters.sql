-- Add per-source fetch filters for remote and recency.

alter table job_sources
  add column if not exists remote_only boolean not null default true,
  add column if not exists posted_within_days integer not null default 1;

update job_sources
set
  remote_only = coalesce(remote_only, true),
  posted_within_days = coalesce(posted_within_days, 1)
where remote_only is null or posted_within_days is null;

alter table job_sources drop constraint if exists chk_job_sources_posted_within_days;

alter table job_sources
  add constraint chk_job_sources_posted_within_days
  check (posted_within_days >= 1);

create index if not exists idx_job_sources_remote_only on job_sources(remote_only);
create index if not exists idx_job_sources_posted_within_days on job_sources(posted_within_days);
