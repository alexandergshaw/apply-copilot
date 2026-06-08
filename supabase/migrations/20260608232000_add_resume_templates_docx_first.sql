-- Docx-first resume templates.
-- Canonical artifact is the uploaded .docx; extracted text supports AI tailoring.

create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists resume_templates (
  id bigint generated always as identity primary key,
  profile_id uuid not null references user_profiles(id) on delete cascade,
  name text not null,
  target_role text,
  original_filename text,
  docx_storage_path text,
  extracted_text text,
  template_text text,
  template_json jsonb default '{}'::jsonb,
  upload_source text default 'docx',
  is_default boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table resume_templates
  add column if not exists profile_id uuid references user_profiles(id) on delete cascade,
  add column if not exists name text,
  add column if not exists target_role text,
  add column if not exists original_filename text,
  add column if not exists docx_storage_path text,
  add column if not exists extracted_text text,
  add column if not exists template_text text,
  add column if not exists template_json jsonb default '{}'::jsonb,
  add column if not exists upload_source text default 'docx',
  add column if not exists is_default boolean default false,
  add column if not exists created_at timestamptz default now(),
  add column if not exists updated_at timestamptz default now();

create index if not exists idx_resume_templates_profile_id on resume_templates(profile_id);
create index if not exists idx_resume_templates_is_default on resume_templates(is_default);

-- One default template per profile.
create or replace function enforce_single_default_resume_template()
returns trigger
language plpgsql
as $$
begin
  if new.is_default then
    update resume_templates
    set is_default = false
    where profile_id = new.profile_id
      and id <> new.id
      and is_default = true;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_resume_templates_updated_at on resume_templates;
create trigger trg_resume_templates_updated_at
  before update on resume_templates
  for each row execute function set_updated_at();

drop trigger if exists trg_resume_templates_single_default on resume_templates;
create trigger trg_resume_templates_single_default
  after insert or update of is_default on resume_templates
  for each row
  when (new.is_default = true)
  execute function enforce_single_default_resume_template();

-- Backfill from older resume_versions table if present and resume_templates is empty.
do $$
begin
  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'resume_versions'
  ) and not exists (select 1 from resume_templates) then
    insert into resume_templates (
      profile_id,
      name,
      target_role,
      template_text,
      template_json,
      is_default,
      upload_source,
      created_at,
      updated_at
    )
    select
      profile_id,
      name,
      target_role,
      resume_text,
      resume_json,
      is_default,
      'manual',
      created_at,
      updated_at
    from resume_versions;
  end if;
end
$$;

alter table resume_templates enable row level security;

drop policy if exists resume_templates_select_all on resume_templates;
drop policy if exists resume_templates_insert_all on resume_templates;
drop policy if exists resume_templates_update_all on resume_templates;
drop policy if exists resume_templates_delete_all on resume_templates;

create policy resume_templates_select_all
on resume_templates
for select
to anon, authenticated
using (true);

create policy resume_templates_insert_all
on resume_templates
for insert
to anon, authenticated
with check (true);

create policy resume_templates_update_all
on resume_templates
for update
to anon, authenticated
using (true)
with check (true);

create policy resume_templates_delete_all
on resume_templates
for delete
to anon, authenticated
using (true);

-- Storage bucket for canonical uploaded resume templates.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'resume-templates',
  'resume-templates',
  false,
  10485760,
  array['application/vnd.openxmlformats-officedocument.wordprocessingml.document']::text[]
)
on conflict (id) do update
set
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists resume_templates_bucket_select on storage.objects;
drop policy if exists resume_templates_bucket_insert on storage.objects;
drop policy if exists resume_templates_bucket_update on storage.objects;
drop policy if exists resume_templates_bucket_delete on storage.objects;

create policy resume_templates_bucket_select
on storage.objects
for select
to anon, authenticated
using (bucket_id = 'resume-templates');

create policy resume_templates_bucket_insert
on storage.objects
for insert
to anon, authenticated
with check (bucket_id = 'resume-templates');

create policy resume_templates_bucket_update
on storage.objects
for update
to anon, authenticated
using (bucket_id = 'resume-templates')
with check (bucket_id = 'resume-templates');

create policy resume_templates_bucket_delete
on storage.objects
for delete
to anon, authenticated
using (bucket_id = 'resume-templates');
