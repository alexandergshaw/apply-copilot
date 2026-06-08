-- Tailored resumes for manually imported jobs.

create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists tailored_resumes (
  id bigint generated always as identity primary key,
  job_id bigint references jobs(id) on delete cascade,
  resume_template_id bigint references resume_templates(id) on delete cascade,
  status text default 'draft' check (status in ('draft', 'reviewed', 'approved', 'rejected', 'stale')),
  tailored_text text not null,
  tailoring_notes text,
  keyword_coverage jsonb default '{}'::jsonb,
  match_score numeric,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_tailored_resumes_job_id on tailored_resumes(job_id);
create index if not exists idx_tailored_resumes_template_id on tailored_resumes(resume_template_id);
create index if not exists idx_tailored_resumes_status on tailored_resumes(status);

drop trigger if exists trg_tailored_resumes_updated_at on tailored_resumes;
create trigger trg_tailored_resumes_updated_at
  before update on tailored_resumes
  for each row execute function set_updated_at();

alter table tailored_resumes enable row level security;

drop policy if exists tailored_resumes_select_all on tailored_resumes;
drop policy if exists tailored_resumes_insert_all on tailored_resumes;
drop policy if exists tailored_resumes_update_all on tailored_resumes;
drop policy if exists tailored_resumes_delete_all on tailored_resumes;

create policy tailored_resumes_select_all
on tailored_resumes
for select
to anon, authenticated
using (true);

create policy tailored_resumes_insert_all
on tailored_resumes
for insert
to anon, authenticated
with check (true);

create policy tailored_resumes_update_all
on tailored_resumes
for update
to anon, authenticated
using (true)
with check (true);

create policy tailored_resumes_delete_all
on tailored_resumes
for delete
to anon, authenticated
using (true);
