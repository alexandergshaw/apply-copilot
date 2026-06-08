-- RLS policies for application submission tracking rows.

alter table applications enable row level security;

drop policy if exists applications_select_all on applications;
drop policy if exists applications_insert_all on applications;
drop policy if exists applications_update_all on applications;

create policy applications_select_all
on applications
for select
to anon, authenticated
using (true);

create policy applications_insert_all
on applications
for insert
to anon, authenticated
with check (true);

create policy applications_update_all
on applications
for update
to anon, authenticated
using (true)
with check (true);
