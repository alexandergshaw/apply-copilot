-- Expand profile storage and add resume versioning.
-- This migration is safe to run against existing environments.

create extension if not exists pgcrypto;

create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Ensure user_profiles exists and has the full profile schema.
create table if not exists user_profiles (
  id uuid primary key default gen_random_uuid()
);

alter table user_profiles
  add column if not exists id uuid default gen_random_uuid(),
  add column if not exists name text,
  add column if not exists email text,
  add column if not exists phone text,
  add column if not exists location text,
  add column if not exists linkedin_url text,
  add column if not exists portfolio_url text,
  add column if not exists github_url text,
  add column if not exists target_titles text[],
  add column if not exists target_locations text[],
  add column if not exists min_salary integer,
  add column if not exists remote_preference text,
  add column if not exists skills text[],
  add column if not exists resume_text text,
  add column if not exists summary text,
  add column if not exists work_history jsonb default '[]'::jsonb,
  add column if not exists education jsonb default '[]'::jsonb,
  add column if not exists certifications jsonb default '[]'::jsonb,
  add column if not exists projects jsonb default '[]'::jsonb,
  add column if not exists preferences jsonb default '{}'::jsonb,
  add column if not exists created_at timestamptz default now(),
  add column if not exists updated_at timestamptz default now();

-- Ensure id has a primary key if this table was created without one.
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'user_profiles'::regclass
      and contype = 'p'
  ) then
    alter table user_profiles add constraint user_profiles_pkey primary key (id);
  end if;
end
$$;

create table if not exists resume_versions (
  id bigint generated always as identity primary key,
  profile_id uuid not null references user_profiles(id) on delete cascade,
  name text not null,
  target_role text,
  resume_text text not null,
  resume_json jsonb default '{}'::jsonb,
  is_default boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_resume_versions_profile_id on resume_versions(profile_id);
create index if not exists idx_resume_versions_is_default on resume_versions(is_default);
create index if not exists idx_user_profiles_email on user_profiles(email);

-- Keep updated_at in sync.
drop trigger if exists trg_user_profiles_updated_at on user_profiles;
create trigger trg_user_profiles_updated_at
  before update on user_profiles
  for each row execute function set_updated_at();

drop trigger if exists trg_resume_versions_updated_at on resume_versions;
create trigger trg_resume_versions_updated_at
  before update on resume_versions
  for each row execute function set_updated_at();

-- Enforce one default resume per profile.
create or replace function enforce_single_default_resume_version()
returns trigger
language plpgsql
as $$
begin
  if new.is_default then
    update resume_versions
    set is_default = false
    where profile_id = new.profile_id
      and id <> new.id
      and is_default = true;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_resume_versions_single_default on resume_versions;
create trigger trg_resume_versions_single_default
  after insert or update of is_default on resume_versions
  for each row
  when (new.is_default = true)
  execute function enforce_single_default_resume_version();
