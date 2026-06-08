-- RLS policies for profile and resume storage tables.
-- The current app flow uses anon/authenticated role access from server actions
-- (no user auth model yet), so these policies allow read/write operations.

alter table user_profiles enable row level security;
alter table resume_versions enable row level security;

drop policy if exists user_profiles_select_all on user_profiles;
drop policy if exists user_profiles_insert_all on user_profiles;
drop policy if exists user_profiles_update_all on user_profiles;

create policy user_profiles_select_all
on user_profiles
for select
to anon, authenticated
using (true);

create policy user_profiles_insert_all
on user_profiles
for insert
to anon, authenticated
with check (true);

create policy user_profiles_update_all
on user_profiles
for update
to anon, authenticated
using (true)
with check (true);

drop policy if exists resume_versions_select_all on resume_versions;
drop policy if exists resume_versions_insert_all on resume_versions;
drop policy if exists resume_versions_update_all on resume_versions;
drop policy if exists resume_versions_delete_all on resume_versions;

create policy resume_versions_select_all
on resume_versions
for select
to anon, authenticated
using (true);

create policy resume_versions_insert_all
on resume_versions
for insert
to anon, authenticated
with check (true);

create policy resume_versions_update_all
on resume_versions
for update
to anon, authenticated
using (true)
with check (true);

create policy resume_versions_delete_all
on resume_versions
for delete
to anon, authenticated
using (true);
