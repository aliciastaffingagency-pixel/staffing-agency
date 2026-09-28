-- can_access_thread(id) looks the thread up by id, which a STABLE function can't
-- see during the INSERT ... RETURNING that creates it. Check the row's own columns.
drop policy if exists "participants read threads" on public.message_threads;
create policy "participants read threads" on public.message_threads
  for select to authenticated
  using (client_id in (select private.my_client_ids()) or private.is_admin(agency_id));
