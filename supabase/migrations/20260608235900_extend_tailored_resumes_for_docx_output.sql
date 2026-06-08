-- Extend tailored_resumes to track generated DOCX artifacts.

alter table tailored_resumes
  add column if not exists output_filename text,
  add column if not exists output_docx_storage_path text,
  add column if not exists source_docx_storage_path text,
  add column if not exists tailored_text text,
  add column if not exists tailoring_notes text,
  add column if not exists keyword_coverage jsonb default '{}'::jsonb,
  add column if not exists match_score numeric,
  add column if not exists status text default 'draft';

alter table tailored_resumes
  alter column tailored_text set default '';

update tailored_resumes
set tailored_text = ''
where tailored_text is null;

alter table tailored_resumes
  alter column tailored_text set not null;

alter table tailored_resumes
  alter column keyword_coverage set default '{}'::jsonb;

update tailored_resumes
set keyword_coverage = '{}'::jsonb
where keyword_coverage is null;

alter table tailored_resumes
  alter column status set default 'draft';

do $$
declare
  existing_constraint text;
begin
  select c.conname
  into existing_constraint
  from pg_constraint c
  join pg_class t on c.conrelid = t.oid
  where t.relname = 'tailored_resumes'
    and c.contype = 'c'
    and pg_get_constraintdef(c.oid) ilike '%status%';

  if existing_constraint is not null then
    execute format('alter table tailored_resumes drop constraint %I', existing_constraint);
  end if;
end
$$;

alter table tailored_resumes
  add constraint tailored_resumes_status_check
  check (status in ('draft', 'reviewed', 'approved', 'rejected', 'stale'));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'tailored-resumes',
  'tailored-resumes',
  false,
  10485760,
  array['application/vnd.openxmlformats-officedocument.wordprocessingml.document']::text[]
)
on conflict (id) do update
set
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists tailored_resumes_bucket_select on storage.objects;
drop policy if exists tailored_resumes_bucket_insert on storage.objects;
drop policy if exists tailored_resumes_bucket_update on storage.objects;
drop policy if exists tailored_resumes_bucket_delete on storage.objects;

create policy tailored_resumes_bucket_select
on storage.objects
for select
to anon, authenticated
using (bucket_id = 'tailored-resumes');

create policy tailored_resumes_bucket_insert
on storage.objects
for insert
to anon, authenticated
with check (bucket_id = 'tailored-resumes');

create policy tailored_resumes_bucket_update
on storage.objects
for update
to anon, authenticated
using (bucket_id = 'tailored-resumes')
with check (bucket_id = 'tailored-resumes');

create policy tailored_resumes_bucket_delete
on storage.objects
for delete
to anon, authenticated
using (bucket_id = 'tailored-resumes');