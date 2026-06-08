-- ApplyCopilot initial schema
-- Creates core tables, indexes, and updated_at triggers.
-- Note: Row Level Security (RLS) is intentionally NOT enabled yet.

-- Trigger function to keep updated_at current on row updates.
create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- 1. user_profiles
create table user_profiles (
  id uuid primary key default gen_random_uuid(),
  name text,
  target_titles text[],
  target_locations text[],
  min_salary integer,
  remote_preference text,
  skills text[],
  resume_text text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 2. job_sources
create table job_sources (
  id bigint generated always as identity primary key,
  name text not null,
  source_type text not null,
  url text not null,
  enabled boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 3. jobs
create table jobs (
  id bigint generated always as identity primary key,
  source_id bigint references job_sources(id),
  title text not null,
  company text,
  location text,
  salary text,
  description text,
  apply_url text unique,
  status text default 'found',
  match_score numeric,
  match_reason text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 4. application_packets
create table application_packets (
  id bigint generated always as identity primary key,
  job_id bigint references jobs(id) on delete cascade,
  tailored_resume text,
  cover_letter text,
  short_answers jsonb,
  risk_notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 5. applications
create table applications (
  id bigint generated always as identity primary key,
  job_id bigint references jobs(id) on delete cascade,
  packet_id bigint references application_packets(id),
  status text default 'review',
  applied_at timestamptz,
  notes text,
  follow_up_date date,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Indexes
create index idx_jobs_status on jobs(status);
create index idx_jobs_match_score on jobs(match_score);
create index idx_jobs_company on jobs(company);
create index idx_applications_status on applications(status);
create index idx_applications_follow_up_date on applications(follow_up_date);

-- updated_at triggers
create trigger trg_user_profiles_updated_at
  before update on user_profiles
  for each row execute function set_updated_at();

create trigger trg_job_sources_updated_at
  before update on job_sources
  for each row execute function set_updated_at();

create trigger trg_jobs_updated_at
  before update on jobs
  for each row execute function set_updated_at();

create trigger trg_application_packets_updated_at
  before update on application_packets
  for each row execute function set_updated_at();

create trigger trg_applications_updated_at
  before update on applications
  for each row execute function set_updated_at();
