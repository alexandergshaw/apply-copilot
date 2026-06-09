-- Add per-source fetch cadence overrides.
--
-- When null, source cadence falls back to worker default
-- DEFAULT_FETCH_INTERVAL_MINUTES (10 by default).

alter table job_sources
  add column if not exists fetch_interval_minutes integer;

alter table job_sources drop constraint if exists chk_job_sources_fetch_interval_minutes;

alter table job_sources
  add constraint chk_job_sources_fetch_interval_minutes
  check (fetch_interval_minutes is null or fetch_interval_minutes > 0);
