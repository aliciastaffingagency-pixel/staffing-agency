-- The staff→clients policy queried booking_requests directly, whose own policies
-- query clients → infinite RLS recursion. Resolve through a SECURITY DEFINER helper.
drop policy if exists "staff reads clients of own placements" on public.clients;

create or replace function private.my_placement_client_ids()
returns setof uuid
language sql stable security definer
set search_path = ''
as $$
  select b.client_id
  from public.booking_requests b
  join public.staff_profiles sp on sp.id = b.staff_id
  where sp.user_id = (select auth.uid())
    and b.status in ('contracted', 'active', 'completed');
$$;
grant execute on function private.my_placement_client_ids() to authenticated;

create policy "staff reads clients of own placements" on public.clients
  for select to authenticated
  using (id in (select private.my_placement_client_ids()));
