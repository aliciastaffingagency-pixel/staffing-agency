-- touch_thread (fired by a client's new message) updates the thread from inside a
-- trigger; only police direct updates, not writes made by our own triggers.
create or replace function private.guard_thread_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if pg_trigger_depth() > 1 then
    return new;
  end if;
  if (select auth.role()) = 'authenticated' and not private.is_admin(old.agency_id) then
    if (to_jsonb(new) - 'client_last_read_at') is distinct from (to_jsonb(old) - 'client_last_read_at') then
      raise exception 'clients can only mark threads as read';
    end if;
  end if;
  return new;
end;
$$;
