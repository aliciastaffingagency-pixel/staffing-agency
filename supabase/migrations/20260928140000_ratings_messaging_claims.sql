-- =============================================================================
-- Phase 4: ratings, messaging (incl. replacement / dispute requests), claims.
-- =============================================================================

create type public.thread_kind as enum ('general', 'replacement', 'dispute', 'extension', 'end_request');
create type public.thread_status as enum ('open', 'resolved');

alter type public.notification_type add value if not exists 'new_message';
alter type public.notification_type add value if not exists 'claim_update';

alter table public.message_threads
  add column kind public.thread_kind not null default 'general',
  add column status public.thread_status not null default 'open',
  add column resolved_at timestamptz,
  add column staff_id uuid references public.staff_profiles (id) on delete set null,
  add column claim_id uuid references public.existing_staff_claims (id) on delete set null,
  add column client_last_read_at timestamptz not null default now(),
  add column admin_last_read_at timestamptz not null default now();
create index message_threads_agency_idx on public.message_threads (agency_id, status, last_message_at desc);

-- Keep threads sorted by activity; any new message re-opens a resolved thread.
create or replace function private.touch_thread()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  update public.message_threads
     set last_message_at = new.created_at,
         status = 'open',
         resolved_at = null,
         client_last_read_at = case when new.sender_role = 'client' then new.created_at else client_last_read_at end,
         admin_last_read_at = case when new.sender_role = 'super_admin' then new.created_at else admin_last_read_at end
   where id = new.thread_id;
  return new;
end;
$$;
create trigger touch_thread after insert on public.messages
  for each row execute function private.touch_thread();

-- Clients may mark their own threads read, and nothing else.
create policy "client marks own thread read" on public.message_threads
  for update to authenticated
  using (client_id in (select private.my_client_ids()))
  with check (client_id in (select private.my_client_ids()));

create or replace function private.guard_thread_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (select auth.role()) = 'authenticated' and not private.is_admin(old.agency_id) then
    if (to_jsonb(new) - 'client_last_read_at') is distinct from (to_jsonb(old) - 'client_last_read_at') then
      raise exception 'clients can only mark threads as read';
    end if;
  end if;
  return new;
end;
$$;
create trigger guard_thread_update before update on public.message_threads
  for each row execute function private.guard_thread_update();

-- A client's thread may only reference their own booking / claim.
drop policy if exists "client opens own thread" on public.message_threads;
create policy "client opens own thread" on public.message_threads
  for insert to authenticated
  with check (
    client_id in (select private.my_client_ids())
    and agency_id = (select c.agency_id from public.clients c where c.id = client_id)
    and status = 'open'
    and (booking_request_id is null or exists (select 1 from public.booking_requests b where b.id = booking_request_id and b.client_id = message_threads.client_id))
    and (claim_id is null or exists (select 1 from public.existing_staff_claims cl where cl.id = claim_id and cl.client_id = message_threads.client_id))
  );

-- One review per contract / per confirmed claim.
create unique index ratings_one_per_contract on public.ratings (client_id, contract_id) where contract_id is not null;
create unique index ratings_one_per_claim on public.ratings (client_id, claim_id) where claim_id is not null;
alter table public.ratings add constraint rating_comment_length check (comment is null or length(comment) <= 2000);
alter table public.ratings add column admin_note text;
