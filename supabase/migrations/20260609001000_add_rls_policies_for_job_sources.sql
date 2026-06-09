-- RLS policies for job_sources management.
--
-- The current app uses the Supabase anon key from server actions to manage
-- sources on /sources, so we allow anon/authenticated access for now.

alter table job_sources enable row level security;

drop policy if exists job_sources_select_all on job_sources;
drop policy if exists job_sources_insert_all on job_sources;
drop policy if exists job_sources_update_all on job_sources;
drop policy if exists job_sources_delete_all on job_sources;

create policy job_sources_select_all
on job_sources
for select
to anon, authenticated
using (true);

create policy job_sources_insert_all
on job_sources
for insert
to anon, authenticated
with check (true);

create policy job_sources_update_all
on job_sources
for update
to anon, authenticated
using (true)
with check (true);

create policy job_sources_delete_all
on job_sources
for delete
to anon, authenticated
using (true);
