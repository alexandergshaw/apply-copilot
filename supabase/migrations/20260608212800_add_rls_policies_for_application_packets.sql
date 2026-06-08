-- RLS policies for application packet placeholder creation.

alter table application_packets enable row level security;

drop policy if exists application_packets_select_all on application_packets;
drop policy if exists application_packets_insert_all on application_packets;
drop policy if exists application_packets_update_all on application_packets;

create policy application_packets_select_all
on application_packets
for select
to anon, authenticated
using (true);

create policy application_packets_insert_all
on application_packets
for insert
to anon, authenticated
with check (true);

create policy application_packets_update_all
on application_packets
for update
to anon, authenticated
using (true)
with check (true);
