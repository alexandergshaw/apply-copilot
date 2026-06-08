-- RLS policies for manual job import and auto-apply queue actions.
--
-- Current app flow uses Supabase anon key from server actions and does not yet
-- implement user auth. These policies allow anon/authenticated roles to read
-- and mutate job queue data so production inserts do not fail.

alter table jobs enable row level security;
alter table auto_apply_runs enable row level security;

drop policy if exists jobs_select_all on jobs;
drop policy if exists jobs_insert_all on jobs;
drop policy if exists jobs_update_all on jobs;

create policy jobs_select_all
on jobs
for select
to anon, authenticated
using (true);

create policy jobs_insert_all
on jobs
for insert
to anon, authenticated
with check (true);

create policy jobs_update_all
on jobs
for update
to anon, authenticated
using (true)
with check (true);

drop policy if exists auto_apply_runs_select_all on auto_apply_runs;
drop policy if exists auto_apply_runs_insert_all on auto_apply_runs;
drop policy if exists auto_apply_runs_update_all on auto_apply_runs;

create policy auto_apply_runs_select_all
on auto_apply_runs
for select
to anon, authenticated
using (true);

create policy auto_apply_runs_insert_all
on auto_apply_runs
for insert
to anon, authenticated
with check (true);

create policy auto_apply_runs_update_all
on auto_apply_runs
for update
to anon, authenticated
using (true)
with check (true);
